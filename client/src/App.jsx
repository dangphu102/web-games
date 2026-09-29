import React, { useEffect, useRef, useState } from 'react';
import { io } from 'socket.io-client';
import { QRCodeSVG } from 'qrcode.react';
import {
  ArrowLeft,
  Check,
  ChevronRight,
  Clipboard,
  Crown,
  Gamepad2,
  Heart,
  Link2,
  MonitorPlay,
  PartyPopper,
  Smartphone,
  Sparkles,
  Trophy,
  Users,
  Wifi,
  X,
} from 'lucide-react';

const avatars = ['🦊', '🐼', '🐸', '🐯', '🐰', '🐻', '🐙', '🦄'];
const colors = ['coral', 'blue', 'yellow', 'green'];
const gameNames = { quiz: 'Tri thức gia đình', drawing: 'Tam sao thất bản', bluff: 'Ai là kẻ nói dối?' };

function drawSegment(canvas, segment) {
  if (!canvas) return;
  const context = canvas.getContext('2d');
  context.strokeStyle = segment.color;
  context.lineWidth = segment.width * canvas.width;
  context.lineCap = 'round';
  context.lineJoin = 'round';
  context.beginPath();
  context.moveTo(segment.x1 * canvas.width, segment.y1 * canvas.height);
  context.lineTo(segment.x2 * canvas.width, segment.y2 * canvas.height);
  context.stroke();
}

function DrawingCanvas({ canvasRef, interactive, onSegment }) {
  const pointer = useRef(null);

  function pointFromEvent(event) {
    const bounds = event.currentTarget.getBoundingClientRect();
    return { x: (event.clientX - bounds.left) / bounds.width, y: (event.clientY - bounds.top) / bounds.height };
  }

  function startDrawing(event) {
    if (!interactive) return;
    event.currentTarget.setPointerCapture(event.pointerId);
    pointer.current = pointFromEvent(event);
  }

  function continueDrawing(event) {
    if (!interactive || !pointer.current) return;
    const next = pointFromEvent(event);
    const segment = { x1: pointer.current.x, y1: pointer.current.y, x2: next.x, y2: next.y, color: '#173a34', width: 0.009 };
    drawSegment(canvasRef.current, segment);
    onSegment(segment);
    pointer.current = next;
  }

  return <canvas ref={canvasRef} className={`drawing-canvas ${interactive ? 'is-drawable' : ''}`} width="960" height="480" onPointerDown={startDrawing} onPointerMove={continueDrawing} onPointerUp={() => { pointer.current = null; }} onPointerCancel={() => { pointer.current = null; }} aria-label={interactive ? 'Bảng vẽ' : 'Hình vẽ đang được đoán'} />;
}

function Scoreboard({ room, title, children }) {
  return <div className="score-panel"><div className="section-heading"><h2><Trophy size={17} /> {title}</h2></div>{room.players.slice().sort((a, b) => b.score - a.score).map((player, index) => <div className="score-row" key={player.id}><span className="score-rank">{String(index + 1).padStart(2, '0')}</span><span>{player.avatar}</span><b>{player.name}</b><strong>{player.score}</strong></div>)}{children}</div>;
}

function App() {
  const [socket, setSocket] = useState(null);
  const [connected, setConnected] = useState(false);
  const [screen, setScreen] = useState('home');
  const [room, setRoom] = useState(null);
  const [roomCode, setRoomCode] = useState(new URLSearchParams(location.search).get('room')?.toUpperCase() || '');
  const [name, setName] = useState('');
  const [avatar, setAvatar] = useState(avatars[0]);
  const [error, setError] = useState('');
  const [question, setQuestion] = useState(null);
  const [results, setResults] = useState(null);
  const [answered, setAnswered] = useState(false);
  const [remaining, setRemaining] = useState(20);
  const [copied, setCopied] = useState(false);
  const [drawing, setDrawing] = useState({ turn: null, word: '', progress: null, result: null, guessResult: null, guessed: false });
  const [bluff, setBluff] = useState({ prompt: null, vote: null, result: null, submitted: false, voted: false });
  const canvasRef = useRef(null);

  useEffect(() => {
    const serverUrl = import.meta.env.VITE_SERVER_URL || location.origin;
    const connection = io(serverUrl);
    setSocket(connection);
    connection.on('connect', () => setConnected(true));
    connection.on('disconnect', () => setConnected(false));
    connection.on('room:created', (data) => {
      setRoom(data);
      setRoomCode(data.code);
      setScreen('lobby');
      setError('');
    });
    connection.on('room:joined', (data) => {
      setRoom(data);
      setRoomCode(data.code);
      setScreen('lobby');
      setError('');
    });
    connection.on('room:update', setRoom);
    connection.on('room:error', (message) => setError(message));
    connection.on('room:closed', () => {
      setRoom(null);
      setScreen('home');
      setError('Phòng đã đóng vì chủ phòng rời đi.');
    });
    connection.on('game:question', (data) => {
      setQuestion(data);
      setAnswered(false);
      setRemaining(Math.max(0, Math.ceil((data.deadline - Date.now()) / 1000)));
      setScreen('question');
    });
    connection.on('game:results', (data) => {
      setResults(data);
      setScreen('results');
    });
    connection.on('game:finished', (data) => {
      setRoom(data.room);
      setScreen('finished');
    });
    connection.on('draw:turn', (turn) => {
      setDrawing({ turn, word: '', progress: null, result: null, guessResult: null, guessed: false });
      setScreen('drawing');
      setRemaining(Math.max(0, Math.ceil((turn.deadline - Date.now()) / 1000)));
      const canvas = canvasRef.current;
      if (canvas) canvas.getContext('2d').clearRect(0, 0, canvas.width, canvas.height);
    });
    connection.on('draw:secret', ({ word }) => setDrawing((current) => ({ ...current, word })));
    connection.on('draw:stroke', (segment) => drawSegment(canvasRef.current, segment));
    connection.on('draw:clear', () => {
      const canvas = canvasRef.current;
      if (canvas) canvas.getContext('2d').clearRect(0, 0, canvas.width, canvas.height);
    });
    connection.on('draw:progress', (progress) => setDrawing((current) => ({ ...current, progress })));
    connection.on('draw:guess-result', (guessResult) => setDrawing((current) => ({ ...current, guessResult, guessed: guessResult.isCorrect })));
    connection.on('draw:turn-results', (result) => {
      setDrawing((current) => ({ ...current, result }));
      setScreen('draw-results');
    });
    connection.on('bluff:prompt', (prompt) => {
      setBluff({ prompt, vote: null, result: null, submitted: false, voted: false });
      setScreen('bluff-submit');
      setRemaining(Math.max(0, Math.ceil((prompt.deadline - Date.now()) / 1000)));
    });
    connection.on('bluff:submitted', () => setBluff((current) => ({ ...current, submitted: true })));
    connection.on('bluff:vote', (vote) => {
      setBluff((current) => ({ ...current, vote, voted: false }));
      setScreen('bluff-vote');
      setRemaining(Math.max(0, Math.ceil((vote.deadline - Date.now()) / 1000)));
    });
    connection.on('bluff:voted', () => setBluff((current) => ({ ...current, voted: true })));
    connection.on('bluff:results', (result) => {
      setBluff((current) => ({ ...current, result }));
      setScreen('bluff-results');
    });

    return () => connection.disconnect();
  }, []);

  useEffect(() => {
    if (screen !== 'question' || !question?.deadline) return undefined;
    const timer = window.setInterval(() => {
      setRemaining(Math.max(0, Math.ceil((question.deadline - Date.now()) / 1000)));
    }, 250);
    return () => window.clearInterval(timer);
  }, [screen, question]);

  useEffect(() => {
    const deadline = screen === 'drawing' ? drawing.turn?.deadline : screen === 'bluff-submit' ? bluff.prompt?.deadline : screen === 'bluff-vote' ? bluff.vote?.deadline : null;
    if (!deadline) return undefined;
    const timer = window.setInterval(() => setRemaining(Math.max(0, Math.ceil((deadline - Date.now()) / 1000))), 250);
    return () => window.clearInterval(timer);
  }, [screen, drawing.turn, bluff.prompt, bluff.vote]);

  const isHost = room?.hostId === socket?.id;
  const minimumPlayers = room?.game === 'quiz' ? 1 : 2;
  const inviteUrl = room ? `${location.origin}/?room=${encodeURIComponent(room.code)}` : '';

  function createRoom() {
    if (!connected) return setError('Đang kết nối máy chủ, thử lại sau một chút nhé.');
    socket.emit('room:create');
  }

  function joinRoom(event) {
    event.preventDefault();
    if (!connected) return setError('Chưa kết nối được máy chủ.');
    socket.emit('room:join', { code: roomCode.trim().toUpperCase(), name: name.trim(), avatar });
  }

  function startGame() {
    socket.emit('game:start', { code: room.code });
  }

  function selectGame(game) {
    socket.emit('room:set-game', { code: room.code, game });
  }

  function sendAnswer(index) {
    if (answered) return;
    setAnswered(true);
    socket.emit('game:answer', { code: room.code, answerIndex: index });
  }

  function continueGame() {
    socket.emit('game:next', { code: room.code });
  }

  function sendDrawingSegment(segment) {
    socket.emit('draw:stroke', { code: room.code, segment });
  }

  function clearDrawing() {
    socket.emit('draw:clear', { code: room.code });
    const canvas = canvasRef.current;
    if (canvas) canvas.getContext('2d').clearRect(0, 0, canvas.width, canvas.height);
  }

  function sendGuess(event) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    socket.emit('draw:guess', { code: room.code, guess: form.get('guess') });
    event.currentTarget.reset();
  }

  function submitBluff(event) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    socket.emit('bluff:submit', { code: room.code, answer: form.get('bluff-answer') });
  }

  function voteBluff(choiceId) {
    socket.emit('bluff:vote', { code: room.code, choiceId });
  }

  async function copyInvite() {
    try {
      await navigator.clipboard.writeText(inviteUrl);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1800);
    } catch {
      setError(`Mã phòng ${room.code} đã sẵn sàng để chia sẻ.`);
    }
  }

  function leaveRoom() {
    socket?.disconnect();
    socket?.connect();
    setRoom(null);
    setQuestion(null);
    setResults(null);
    setScreen('home');
  }

  return (
    <main className="app-shell">
      <header className="topbar">
        <button className="brand" onClick={() => screen === 'home' && setError('')} aria-label="Nhà Mình Chơi Gì?">
          <span className="brand-mark"><Gamepad2 size={21} strokeWidth={2.5} /></span>
          <span>nhà mình <b>chơi gì?</b></span>
        </button>
        <div className={`connection ${connected ? 'is-online' : ''}`}>
          <span className="connection-dot" />
          <span>{connected ? 'Đã kết nối' : 'Đang kết nối'}</span>
        </div>
      </header>

      {error && <div className="toast" role="status"><X size={16} />{error}<button onClick={() => setError('')} aria-label="Đóng thông báo"><X size={14} /></button></div>}

      {screen === 'home' && (
        <section className="home-layout">
          <div className="welcome-panel">
            <div className="eyebrow"><Sparkles size={14} /> TỐI NAY CẢ NHÀ CHƠI GÌ?</div>
            <h1>Một phòng.<br /><span>Cả nhà vui.</span></h1>
            <p className="intro">Đưa câu hỏi lên màn hình lớn. Mỗi người dùng điện thoại làm tay cầm. Chơi ngay, không cần cài app.</p>
            <div className="home-actions">
              <button className="button button-primary" onClick={createRoom}>
                <MonitorPlay size={18} /> Tạo phòng chơi <ChevronRight size={17} />
              </button>
              <span className="action-caption"><Wifi size={14} /> Chủ phòng mở trên TV hoặc laptop</span>
            </div>
            <div className="game-stamp"><span className="stamp-icon"><Heart size={18} fill="currentColor" /></span><span><b>Chơi cùng người thân</b><small>Niềm vui ở ngay trong nhà</small></span></div>
          </div>

          <div className="join-panel">
            <div className="panel-topline"><span className="panel-kicker">ĐÃ CÓ MÃ PHÒNG?</span><Smartphone size={19} /></div>
            <h2>Vào chơi cùng nhé</h2>
            <p>Dùng điện thoại của bạn để tham gia phòng.</p>
            <form onSubmit={joinRoom} className="join-form">
              <label htmlFor="room-code">Mã phòng</label>
              <input id="room-code" className="code-input" maxLength={4} placeholder="VD: MEO7" value={roomCode} onChange={(event) => setRoomCode(event.target.value.toUpperCase())} autoComplete="off" />
              <label htmlFor="player-name">Tên của bạn</label>
              <input id="player-name" maxLength={18} placeholder="Nhập tên hiển thị" value={name} onChange={(event) => setName(event.target.value)} autoComplete="nickname" required />
              <div className="avatar-label">Chọn bạn đồng hành</div>
              <div className="avatar-picker" role="group" aria-label="Chọn avatar">
                {avatars.map((item) => <button type="button" key={item} className={`avatar-option ${avatar === item ? 'selected' : ''}`} onClick={() => setAvatar(item)} aria-label={`Chọn ${item}`} aria-pressed={avatar === item}>{item}</button>)}
              </div>
              <button className="button button-dark join-button" type="submit"><Users size={17} /> Tham gia phòng <ChevronRight size={16} /></button>
            </form>
          </div>

          <div className="game-preview">
            <div className="preview-heading"><span>TRÒ CHƠI ĐANG CÓ</span><span className="live-label"><span /> SẴN SÀNG</span></div>
            <div className="game-row"><span className="game-icon quiz">?</span><span className="game-copy"><b>Tri thức gia đình</b><small>Quiz · Nhanh trí, nhớ lâu</small></span><span className="game-status">ĐANG CÓ</span></div>
            <div className="game-row"><span className="game-icon draw">✎</span><span className="game-copy"><b>Tam sao thất bản</b><small>Vẽ · Đoán · Cười</small></span><span className="game-status">ĐANG CÓ</span></div>
            <div className="game-row"><span className="game-icon bluff">!</span><span className="game-copy"><b>Ai là kẻ nói dối?</b><small>Bịa đáp án · Tìm sự thật</small></span><span className="game-status">ĐANG CÓ</span></div>
          </div>
        </section>
      )}

      {screen === 'lobby' && room && (
        <section className="room-layout">
          <button className="back-link" onClick={leaveRoom}><ArrowLeft size={16} /> Rời phòng</button>
          <div className="room-heading"><div><div className="eyebrow"><span className="live-label"><span /> PHÒNG ĐANG MỞ</span></div><h1>Phòng chờ<span className="period">.</span></h1><p>Mời mọi người vào phòng, bắt đầu khi cả nhà đã sẵn sàng.</p></div>
            <div className="room-code-box"><small>MÃ PHÒNG</small><strong>{room.code}</strong><button onClick={copyInvite}><Link2 size={15} /> {copied ? 'Đã sao chép' : 'Mời người chơi'}</button><div className="invite-qr" role="img" aria-label={`Mã QR để tham gia phòng ${room.code}`}><QRCodeSVG value={inviteUrl} size={128} level="M" /><span>Quét để vào phòng</span></div></div>
          </div>
          <div className="lobby-content">
            <div className="players-section"><div className="section-heading"><h2>Đang ở đây</h2><span><Users size={15} /> {room.players.length} người</span></div>
              {room.players.length ? <div className="player-list">{room.players.map((player, index) => <div className="player-item" key={player.id}><div className={`player-avatar avatar-${index % 4}`}>{player.avatar}</div><div className="player-meta"><b>{player.name}</b><small>{player.id === room.hostId ? 'Chủ phòng' : 'Đã sẵn sàng'}</small></div>{player.id === room.hostId && <Crown className="host-crown" size={17} />}</div>)}</div> : <div className="empty-players"><div className="empty-orbit">👋</div><b>Đang chờ người chơi...</b><span>Chia sẻ mã phòng để mọi người cùng vào</span></div>}
              <div className="invite-strip"><div className="invite-icon"><Clipboard size={17} /></div><span><b>Gửi lời mời</b><small>Quét QR hoặc mở trang chủ rồi nhập mã phòng</small></span><button onClick={copyInvite} aria-label="Sao chép liên kết mời"><Clipboard size={17} /></button></div>
            </div>
            <aside className="start-section"><div className="start-art"><div className="art-spark spark-one">✳</div><div className="art-spark spark-two">✦</div><div className="art-disc"><PartyPopper size={42} /></div><div className="art-doodle">LET'S<br />PLAY!</div></div><span className="panel-kicker">CHỌN TRÒ CHƠI</span><h2>{gameNames[room.game] || gameNames.quiz}</h2><p>{room.game === 'drawing' ? '3 lượt vẽ bí mật. Đoán đúng nhanh để ghi điểm.' : room.game === 'bluff' ? 'Bịa đáp án thật thuyết phục rồi tìm ra sự thật.' : '5 câu hỏi vui. Trả lời nhanh để ghi thật nhiều điểm.'}</p>
              {isHost ? <><div className="game-selector" role="group" aria-label="Chọn trò chơi">{Object.entries(gameNames).map(([game, label]) => <button key={game} className={room.game === game ? 'selected' : ''} aria-pressed={room.game === game} onClick={() => selectGame(game)}>{label}</button>)}</div><small className="minimum-players">{room.players.length < minimumPlayers ? `Cần ít nhất ${minimumPlayers} người chơi để bắt đầu.` : 'Chủ phòng không tính vào số người chơi.'}</small><button className="button button-primary start-button" disabled={room.players.length < minimumPlayers} onClick={startGame}>Bắt đầu chơi <ChevronRight size={17} /></button></> : <div className="waiting-host"><span className="pulse-dot" /> Đang chờ chủ phòng bắt đầu...</div>}
            </aside>
          </div>
        </section>
      )}

      {screen === 'question' && question && room && (
        <section className={`play-layout ${isHost ? 'host-view' : 'controller-view'}`}>
          <div className="play-topline"><button className="back-link" onClick={leaveRoom}><ArrowLeft size={16} /> Rời phòng</button><span className="round-label">CÂU {question.questionNumber} <i>/</i> {question.totalQuestions}</span><span className="room-mini">PHÒNG {room.code}</span></div>
          {isHost ? <div className="host-question"><div className="timer-ring" style={{ '--progress': `${remaining / 20 * 100}%` }}><span>{remaining}</span></div><div className="question-tag">CÂU HỎI {question.questionNumber} / {question.totalQuestions}</div><h1>{question.question.text}</h1><div className="host-options">{question.question.options.map((option, index) => <div className={`host-option option-${colors[index]}`} key={option}><span>{String.fromCharCode(65 + index)}</span>{option}</div>)}</div><div className="response-count"><Users size={16} /> {room.answerCount || 0} / {room.players.length} người đã trả lời</div></div>
            : <div className="controller-content"><div className="mobile-room-label">{room.code} <span>·</span> CÂU {question.questionNumber}/{question.totalQuestions}</div><div className="mobile-timer">{remaining}<small>giây</small></div><h1>{question.question.text}</h1><div className="answer-grid">{question.question.options.map((option, index) => <button key={option} disabled={answered} className={`answer-button option-${colors[index]} ${answered ? 'locked' : ''}`} onClick={() => sendAnswer(index)}><span>{String.fromCharCode(65 + index)}</span><b>{option}</b></button>)}</div><div className={`answer-feedback ${answered ? 'visible' : ''}`}><Check size={16} /> Đã khóa câu trả lời. Chờ cả nhà nhé!</div></div>}
        </section>
      )}

      {screen === 'drawing' && drawing.turn && room && (
        <section className="play-layout drawing-layout">
          <div className="play-topline"><button className="back-link" onClick={leaveRoom}><ArrowLeft size={16} /> Rời phòng</button><span className="round-label">LƯỢT {drawing.turn.roundNumber} <i>/</i> {drawing.turn.totalRounds}</span><span className="room-mini">PHÒNG {room.code}</span></div>
          {isHost ? <div className="draw-host-view"><div className="drawing-heading"><div><span className="question-tag">ĐANG VẼ</span><h1>{drawing.turn.drawer.avatar} {drawing.turn.drawer.name}</h1></div><div className="draw-timer">{remaining}<small>giây</small></div></div><DrawingCanvas canvasRef={canvasRef} /><div className="drawing-foot"><span>{drawing.progress?.correctCount || 0} / {drawing.progress?.playerCount ?? Math.max(0, room.players.length - 1)} người đoán đúng</span><span>{drawing.progress?.isCorrect ? `${drawing.progress.player.name} đoán trúng!` : 'Đang chờ những phỏng đoán...'}</span></div></div>
            : <div className="drawing-controller"><div className="mobile-room-label">{room.code} <span>·</span> LƯỢT {drawing.turn.roundNumber}/{drawing.turn.totalRounds}</div><div className="draw-timer">{remaining}<small>giây</small></div>{drawing.turn.drawer.id === socket?.id ? <><div className="secret-word"><small>TỪ KHÓA CỦA BẠN</small><strong>{drawing.word || 'Đang nhận từ khóa...'}</strong></div><DrawingCanvas canvasRef={canvasRef} interactive onSegment={sendDrawingSegment} /><div className="drawing-tools"><span>Chỉ bạn nhìn thấy từ khóa</span><button onClick={clearDrawing}>Xóa bảng vẽ</button></div></> : <><div className="drawing-heading compact"><h1>{drawing.turn.drawer.avatar} {drawing.turn.drawer.name} đang vẽ</h1></div><DrawingCanvas canvasRef={canvasRef} /><form className="guess-form" onSubmit={sendGuess}><input name="guess" maxLength={60} placeholder="Bạn đoán là gì?" autoComplete="off" disabled={drawing.guessed} required /><button className="button button-dark" disabled={drawing.guessed}>Đoán thử <ChevronRight size={16} /></button></form><div className={`answer-feedback ${drawing.guessResult ? 'visible' : ''}`}>{drawing.guessed ? 'Chính xác! Chờ những người khác nhé.' : drawing.guessResult ? 'Chưa đúng, thử đáp án khác nhé.' : `${drawing.progress?.correctCount || 0} người đã đoán đúng`}</div></>}</div>}
        </section>
      )}

      {screen === 'draw-results' && drawing.result && room && (
        <section className="results-layout"><div className="play-topline"><span className="round-label">KẾT QUẢ LƯỢT {drawing.result.roundNumber}</span><span className="room-mini">PHÒNG {room.code}</span></div><div className="results-header"><div className="result-burst">✦</div><div className="question-tag">TỪ KHÓA LÀ</div><h1>{drawing.result.word}</h1><p>{room.players.find((player) => player.id === drawing.result.drawerId)?.name || 'Người vẽ'} là họa sĩ lượt này.</p></div><div className="results-columns"><div className="answer-results"><div className="section-heading"><h2>Đoán đúng</h2><span>{drawing.result.correctGuessers.length} người</span></div>{drawing.result.correctGuessers.length ? drawing.result.correctGuessers.map((player) => <div className="result-player" key={player.id}><span className="result-avatar">{player.avatar}</span><span className="result-name">{player.name}</span><span className="points positive">+500 điểm</span></div>) : <p className="empty-result">Lượt này chưa ai đoán trúng.</p>}</div><Scoreboard room={room} title="Bảng điểm">{isHost ? <button className="button button-dark next-button" onClick={continueGame}>{drawing.result.roundNumber === drawing.result.totalRounds ? 'Xem kết quả chung' : 'Lượt tiếp theo'} <ChevronRight size={17} /></button> : <div className="waiting-host"><span className="pulse-dot" /> Chủ phòng sẽ bắt đầu lượt tiếp theo</div>}</Scoreboard></div></section>
      )}

      {screen === 'bluff-submit' && bluff.prompt && room && (
        <section className="play-layout bluff-layout"><div className="play-topline"><button className="back-link" onClick={leaveRoom}><ArrowLeft size={16} /> Rời phòng</button><span className="round-label">VÒNG {bluff.prompt.roundNumber} <i>/</i> {bluff.prompt.totalRounds}</span><span className="room-mini">PHÒNG {room.code}</span></div>
          {isHost ? <div className="bluff-host-view"><div className="draw-timer">{remaining}<small>giây</small></div><div className="question-tag">HÃY NGHĨ MỘT ĐÁP ÁN THẬT THUYẾT PHỤC</div><h1>{bluff.prompt.question}</h1><div className="response-count"><Users size={16} /> {room.answerCount || 0} / {room.players.length} người đã gửi đáp án</div><div className="waiting-host"><span className="pulse-dot" /> Đáp án sẽ xuất hiện để mọi người bình chọn</div></div>
            : <div className="bluff-controller"><div className="mobile-room-label">{room.code} <span>·</span> VÒNG {bluff.prompt.roundNumber}/{bluff.prompt.totalRounds}</div><div className="draw-timer">{remaining}<small>giây</small></div><h1>{bluff.prompt.question}</h1>{bluff.submitted ? <div className="bluff-wait"><Check size={19} /><b>Đã gửi đáp án</b><span>Chờ cả nhà cùng bình chọn nhé.</span></div> : <form className="bluff-submit-form" onSubmit={submitBluff}><label htmlFor="bluff-answer">Bịa một đáp án nghe hợp lý</label><input id="bluff-answer" name="bluff-answer" maxLength={100} placeholder="Nhập đáp án của bạn" autoComplete="off" required /><button className="button button-primary">Gửi đáp án <ChevronRight size={16} /></button></form>}</div>}
        </section>
      )}

      {screen === 'bluff-vote' && bluff.vote && room && (
        <section className="play-layout bluff-layout"><div className="play-topline"><button className="back-link" onClick={leaveRoom}><ArrowLeft size={16} /> Rời phòng</button><span className="round-label">BÌNH CHỌN {bluff.vote.roundNumber} <i>/</i> {bluff.vote.totalRounds}</span><span className="room-mini">PHÒNG {room.code}</span></div>
          {isHost ? <div className="bluff-host-view"><div className="draw-timer">{remaining}<small>giây</small></div><div className="question-tag">ĐÁP ÁN NÀO LÀ SỰ THẬT?</div><h1>{bluff.vote.question}</h1><div className="bluff-host-choices">{bluff.vote.choices.map((choice, index) => <div key={choice.id}><span>{String.fromCharCode(65 + index)}</span><b>{choice.text}</b></div>)}</div><p>Mọi người đang bình chọn bằng điện thoại.</p><div className="response-count"><Users size={16} /> {room.answerCount || 0} / {room.players.length} người đã bình chọn</div></div>
            : <div className="bluff-controller"><div className="mobile-room-label">{room.code} <span>·</span> VÒNG {bluff.vote.roundNumber}/{bluff.vote.totalRounds}</div><div className="draw-timer">{remaining}<small>giây</small></div><h1>{bluff.vote.question}</h1>{bluff.voted ? <div className="bluff-wait"><Check size={19} /><b>Lá phiếu đã khóa</b><span>Chờ công bố đáp án nhé.</span></div> : <div className="bluff-choices">{bluff.vote.choices.filter((choice) => choice.id !== socket?.id).map((choice, index) => <button className="bluff-choice" key={choice.id} onClick={() => voteBluff(choice.id)}><span>{String.fromCharCode(65 + index)}</span>{choice.text}</button>)}</div>}</div>}
        </section>
      )}

      {screen === 'bluff-results' && bluff.result && room && (
        <section className="results-layout"><div className="play-topline"><span className="round-label">KẾT QUẢ VÒNG {bluff.result.roundNumber}</span><span className="room-mini">PHÒNG {room.code}</span></div><div className="results-header"><div className="result-burst">✦</div><div className="question-tag">SỰ THẬT LÀ</div><h1>{bluff.result.answer}</h1><p>{bluff.result.question}</p></div><div className="results-columns"><div className="answer-results"><div className="section-heading"><h2>Các đáp án</h2><span>Bình chọn</span></div>{bluff.result.choices.slice().sort((a, b) => b.votes - a.votes).map((choice) => <div className={`bluff-result-choice ${choice.isCorrect ? 'is-correct' : ''}`} key={choice.id}><span className="choice-votes">{choice.votes}</span><span className="choice-result-copy"><b>{choice.text}</b><small>{choice.isCorrect ? 'Đáp án đúng' : `Đáp án của ${choice.authorName}`}</small></span>{choice.isCorrect && <Check size={17} />}</div>)}</div><Scoreboard room={room} title="Bảng điểm">{isHost ? <button className="button button-dark next-button" onClick={continueGame}>{bluff.result.roundNumber === bluff.result.totalRounds ? 'Xem kết quả chung' : 'Vòng tiếp theo'} <ChevronRight size={17} /></button> : <div className="waiting-host"><span className="pulse-dot" /> Chủ phòng sẽ bắt đầu vòng tiếp theo</div>}</Scoreboard></div></section>
      )}

      {screen === 'results' && results && room && (
        <section className="results-layout"><div className="play-topline"><span className="round-label">KẾT QUẢ CÂU {results.questionNumber}</span><span className="room-mini">PHÒNG {room.code}</span></div><div className="results-header"><div className="result-burst">✦</div><div className="question-tag">ĐÁP ÁN ĐÚNG LÀ</div><h1>{results.question.options[results.correctIndex]}</h1><p>{results.question.text}</p></div><div className="results-columns"><div className="answer-results"><div className="section-heading"><h2>Câu trả lời</h2><span>{results.answers.length} người chơi</span></div>{results.answers.map((answer) => <div className="result-player" key={answer.id}><span className="result-avatar">{answer.avatar}</span><span className="result-name">{answer.name}<small>{answer.answerIndex == null ? 'Chưa trả lời' : results.question.options[answer.answerIndex]}</small></span>{answer.isCorrect ? <span className="points positive">+{answer.pointsEarned} điểm</span> : <span className="points">+0 điểm</span>}</div>)}</div><div className="score-panel"><div className="section-heading"><h2><Trophy size={17} /> Bảng điểm</h2></div>{room.players.slice().sort((a, b) => b.score - a.score).map((player, index) => <div className="score-row" key={player.id}><span className="score-rank">{String(index + 1).padStart(2, '0')}</span><span>{player.avatar}</span><b>{player.name}</b><strong>{player.score}</strong></div>)}{isHost ? <button className="button button-dark next-button" onClick={continueGame}>{results.questionNumber === results.totalQuestions ? 'Xem kết quả chung' : 'Câu tiếp theo'} <ChevronRight size={17} /></button> : <div className="waiting-host"><span className="pulse-dot" /> Chủ phòng sẽ bắt đầu câu tiếp theo</div>}</div></div></section>
      )}

      {screen === 'finished' && room && (
        <section className="finished-layout"><div className="finish-confetti">✦</div><div className="eyebrow"><Trophy size={15} /> TỔNG KẾT · {gameNames[room.game]}</div><h1>Cả nhà đỉnh quá<span className="period">!</span></h1><p>{room.game === 'drawing' ? 'Những nét vẽ và phỏng đoán thật đáng nhớ.' : room.game === 'bluff' ? 'Những đáp án nghe thật khó tin mà vẫn hợp lý.' : '5 câu hỏi vui, thật nhiều tiếng cười.'} Đây là bảng điểm chung cuộc.</p><div className="final-scoreboard">{room.players.slice().sort((a, b) => b.score - a.score).map((player, index) => <div className={`final-player ${index === 0 ? 'winner' : ''}`} key={player.id}><span className="final-rank">{index === 0 ? <Crown size={18} /> : String(index + 1).padStart(2, '0')}</span><span className="final-avatar">{player.avatar}</span><b>{player.name}</b><strong>{player.score}<small>điểm</small></strong></div>)}</div>{isHost ? <button className="button button-primary" onClick={leaveRoom}><Gamepad2 size={18} /> Về trang chủ</button> : <div className="waiting-host">Cảm ơn bạn đã chơi cùng cả nhà!</div>}</section>
      )}
      <footer className="footer"><span>NHÀ MÌNH CHƠI GÌ?</span><span>ĐƯỢC LÀM ĐỂ CHƠI CÙNG NHAU <Heart size={12} fill="currentColor" /></span></footer>
    </main>
  );
}

export default App;