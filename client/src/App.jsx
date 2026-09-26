import { useEffect, useState } from 'react';
import { io } from 'socket.io-client';
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

  useEffect(() => {
    const serverUrl = import.meta.env.VITE_SERVER_URL || `${location.protocol}//${location.hostname}:3001`;
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

    return () => connection.disconnect();
  }, []);

  useEffect(() => {
    if (screen !== 'question' || !question?.deadline) return undefined;
    const timer = window.setInterval(() => {
      setRemaining(Math.max(0, Math.ceil((question.deadline - Date.now()) / 1000)));
    }, 250);
    return () => window.clearInterval(timer);
  }, [screen, question]);

  const isHost = room?.hostId === socket?.id;

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

  function sendAnswer(index) {
    if (answered) return;
    setAnswered(true);
    socket.emit('game:answer', { code: room.code, answerIndex: index });
  }

  function continueGame() {
    socket.emit('game:next', { code: room.code });
  }

  async function copyInvite() {
    const invite = `${location.origin}/?room=${room.code}`;
    try {
      await navigator.clipboard.writeText(invite);
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
            <div className="game-row muted"><span className="game-icon draw">✎</span><span className="game-copy"><b>Tam sao thất bản</b><small>Vẽ · Đoán · Cười</small></span><span className="game-status coming">SẮP CÓ</span></div>
          </div>
        </section>
      )}

      {screen === 'lobby' && room && (
        <section className="room-layout">
          <button className="back-link" onClick={leaveRoom}><ArrowLeft size={16} /> Rời phòng</button>
          <div className="room-heading"><div><div className="eyebrow"><span className="live-label"><span /> PHÒNG ĐANG MỞ</span></div><h1>Phòng chờ<span className="period">.</span></h1><p>Mời mọi người vào phòng, bắt đầu khi cả nhà đã sẵn sàng.</p></div>
            <div className="room-code-box"><small>MÃ PHÒNG</small><strong>{room.code}</strong><button onClick={copyInvite}><Link2 size={15} /> {copied ? 'Đã sao chép' : 'Mời người chơi'}</button></div>
          </div>
          <div className="lobby-content">
            <div className="players-section"><div className="section-heading"><h2>Đang ở đây</h2><span><Users size={15} /> {room.players.length} người</span></div>
              {room.players.length ? <div className="player-list">{room.players.map((player, index) => <div className="player-item" key={player.id}><div className={`player-avatar avatar-${index % 4}`}>{player.avatar}</div><div className="player-meta"><b>{player.name}</b><small>{player.id === room.hostId ? 'Chủ phòng' : 'Đã sẵn sàng'}</small></div>{player.id === room.hostId && <Crown className="host-crown" size={17} />}</div>)}</div> : <div className="empty-players"><div className="empty-orbit">👋</div><b>Đang chờ người chơi...</b><span>Chia sẻ mã phòng để mọi người cùng vào</span></div>}
              <div className="invite-strip"><div className="invite-icon"><Clipboard size={17} /></div><span><b>Gửi lời mời</b><small>Nhập mã này trên điện thoại của người chơi</small></span><button onClick={copyInvite} aria-label="Sao chép liên kết mời"><Clipboard size={17} /></button></div>
            </div>
            <aside className="start-section"><div className="start-art"><div className="art-spark spark-one">✳</div><div className="art-spark spark-two">✦</div><div className="art-disc"><PartyPopper size={42} /></div><div className="art-doodle">LET'S<br />PLAY!</div></div><span className="panel-kicker">TRÒ CHƠI ĐẦU TIÊN</span><h2>Tri thức gia đình</h2><p>5 câu hỏi vui. Càng nhanh, điểm càng cao. Chuẩn bị tinh thần nhé!</p>
              {isHost ? <button className="button button-primary start-button" disabled={!room.players.length} onClick={startGame}>Bắt đầu chơi <ChevronRight size={17} /></button> : <div className="waiting-host"><span className="pulse-dot" /> Đang chờ chủ phòng bắt đầu...</div>}
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

      {screen === 'results' && results && room && (
        <section className="results-layout"><div className="play-topline"><span className="round-label">KẾT QUẢ CÂU {results.questionNumber}</span><span className="room-mini">PHÒNG {room.code}</span></div><div className="results-header"><div className="result-burst">✦</div><div className="question-tag">ĐÁP ÁN ĐÚNG LÀ</div><h1>{results.question.options[results.correctIndex]}</h1><p>{results.question.text}</p></div><div className="results-columns"><div className="answer-results"><div className="section-heading"><h2>Câu trả lời</h2><span>{results.answers.length} người chơi</span></div>{results.answers.map((answer) => <div className="result-player" key={answer.id}><span className="result-avatar">{answer.avatar}</span><span className="result-name">{answer.name}<small>{answer.answerIndex == null ? 'Chưa trả lời' : results.question.options[answer.answerIndex]}</small></span>{answer.isCorrect ? <span className="points positive">+{answer.pointsEarned} điểm</span> : <span className="points">+0 điểm</span>}</div>)}</div><div className="score-panel"><div className="section-heading"><h2><Trophy size={17} /> Bảng điểm</h2></div>{room.players.slice().sort((a, b) => b.score - a.score).map((player, index) => <div className="score-row" key={player.id}><span className="score-rank">{String(index + 1).padStart(2, '0')}</span><span>{player.avatar}</span><b>{player.name}</b><strong>{player.score}</strong></div>)}{isHost ? <button className="button button-dark next-button" onClick={continueGame}>{results.questionNumber === results.totalQuestions ? 'Xem kết quả chung' : 'Câu tiếp theo'} <ChevronRight size={17} /></button> : <div className="waiting-host"><span className="pulse-dot" /> Chủ phòng sẽ bắt đầu câu tiếp theo</div>}</div></div></section>
      )}

      {screen === 'finished' && room && (
        <section className="finished-layout"><div className="finish-confetti">✦</div><div className="eyebrow"><Trophy size={15} /> TỔNG KẾT</div><h1>Cả nhà đỉnh quá<span className="period">!</span></h1><p>5 câu hỏi, thật nhiều tiếng cười. Đây là bảng điểm chung cuộc.</p><div className="final-scoreboard">{room.players.slice().sort((a, b) => b.score - a.score).map((player, index) => <div className={`final-player ${index === 0 ? 'winner' : ''}`} key={player.id}><span className="final-rank">{index === 0 ? <Crown size={18} /> : String(index + 1).padStart(2, '0')}</span><span className="final-avatar">{player.avatar}</span><b>{player.name}</b><strong>{player.score}<small>điểm</small></strong></div>)}</div>{isHost ? <button className="button button-primary" onClick={leaveRoom}><Gamepad2 size={18} /> Về trang chủ</button> : <div className="waiting-host">Cảm ơn bạn đã chơi cùng cả nhà!</div>}</section>
      )}
      <footer className="footer"><span>NHÀ MÌNH CHƠI GÌ?</span><span>ĐƯỢC LÀM ĐỂ CHƠI CÙNG NHAU <Heart size={12} fill="currentColor" /></span></footer>
    </main>
  );
}

export default App;