import { useEffect, useRef, useState, useCallback } from 'react';
import { useAuthStore } from '../store/authStore';
import { useMessengerStore, OnlineUser } from '../store/messengerStore';
import { getSocket } from '../utils/socket';
import { format } from 'date-fns';
import { ko } from 'date-fns/locale';
import { Send, Hash, MessageCircle, Circle, Wifi, WifiOff, Copy, Reply, Trash2, X } from 'lucide-react';
import clsx from 'clsx';

function dmRoom(idA: string, idB: string) {
  return 'dm_' + [idA, idB].sort().join('__');
}

function Avatar({ name, size = 8 }: { name: string; size?: number }) {
  const colors = [
    'bg-blue-500', 'bg-emerald-500', 'bg-violet-500',
    'bg-amber-500', 'bg-rose-500', 'bg-cyan-500', 'bg-pink-500',
  ];
  const idx = name.charCodeAt(0) % colors.length;
  return (
    <div
      className={clsx(
        colors[idx],
        'rounded-full flex items-center justify-center text-white font-bold shrink-0',
        `w-${size} h-${size}`
      )}
      style={{ fontSize: size * 2.5 }}
    >
      {name.charAt(0)}
    </div>
  );
}

export default function MessengerPage() {
  const { currentUser } = useAuthStore();
  const {
    connected, setConnected,
    onlineUsers, setOnlineUsers,
    messages, addMessage, setHistory,
    typingUsers, setTyping,
    activeRoom, setActiveRoom,
  } = useMessengerStore();

  const [input, setInput] = useState('');
  const [typingTimer, setTypingTimer] = useState<ReturnType<typeof setTimeout> | null>(null);
  const [menuMsgId, setMenuMsgId] = useState<string | null>(null);
  const [replyTo, setReplyTo] = useState<{ id: string; fromName: string; content: string } | null>(null);
  const [reactions, setReactions] = useState<Record<string, Record<string, string[]>>>({});
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  const EMOJIS = ['👍', '❤️', '😂', '😮', '😢', '🔥'];

  const socket = getSocket();

  // Connect on mount
  useEffect(() => {
    if (!currentUser) return;

    socket.connect();

    socket.on('connect', () => {
      setConnected(true);
      socket.emit('user_join', {
        id: currentUser.id,
        name: currentUser.name,
        department: currentUser.department,
        role: currentUser.role,
      });
    });

    socket.on('disconnect', () => setConnected(false));

    socket.on('online_users', (users: OnlineUser[]) => {
      setOnlineUsers(users);
    });

    socket.on('receive_message', (msg) => {
      addMessage(msg);
    });

    socket.on('room_history', ({ room, messages: msgs }) => {
      setHistory(room, msgs);
    });

    socket.on('user_typing', ({ name, isTyping }: { name: string; isTyping: boolean }) => {
      setTyping(activeRoom, name, isTyping);
    });

    return () => {
      socket.off('connect');
      socket.off('disconnect');
      socket.off('online_users');
      socket.off('receive_message');
      socket.off('room_history');
      socket.off('user_typing');
      socket.disconnect();
      setConnected(false);
    };
  }, [currentUser]);

  // Join room when activeRoom changes
  useEffect(() => {
    if (!connected || !currentUser) return;
    if (activeRoom === 'general') return; // already auto-joined
    const [, a, b] = activeRoom.split('_')[0] === 'dm' ? ['dm', ...activeRoom.replace('dm_', '').split('__')] : [];
    if (a && b) {
      socket.emit('join_dm', { myId: currentUser.id, targetId: a === currentUser.id ? b : a });
    }
  }, [activeRoom, connected]);

  // Scroll to bottom on new message
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages[activeRoom]]);

  // Close menu on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setMenuMsgId(null);
      }
    };
    if (menuMsgId) document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [menuMsgId]);

  const handleReact = (msgId: string, emoji: string) => {
    const userId = currentUser?.id ?? '';
    setReactions((prev) => {
      const msgReactions = { ...(prev[msgId] ?? {}) };
      const users = msgReactions[emoji] ?? [];
      msgReactions[emoji] = users.includes(userId)
        ? users.filter((u) => u !== userId)
        : [...users, userId];
      if (msgReactions[emoji].length === 0) delete msgReactions[emoji];
      return { ...prev, [msgId]: msgReactions };
    });
    setMenuMsgId(null);
  };

  const handleCopy = (content: string) => {
    navigator.clipboard.writeText(content).catch(() => {});
    setMenuMsgId(null);
  };

  const handleReply = (msg: { id: string; fromName: string; content: string }) => {
    setReplyTo(msg);
    setMenuMsgId(null);
    inputRef.current?.focus();
  };

  const handleDeleteMsg = (msgId: string) => {
    useMessengerStore.getState().setHistory(
      activeRoom,
      (messages[activeRoom] ?? []).filter((m) => m.id !== msgId)
    );
    setMenuMsgId(null);
  };

  const handleOpenDM = useCallback((target: OnlineUser) => {
    if (!currentUser) return;
    const room = dmRoom(currentUser.id, target.id);
    setActiveRoom(room);
    socket.emit('join_dm', { myId: currentUser.id, targetId: target.id });
  }, [currentUser]);

  const handleSend = useCallback(() => {
    if (!input.trim() || !currentUser || !connected) return;
    const content = replyTo
      ? `> ${replyTo.fromName}: ${replyTo.content.slice(0, 60)}${replyTo.content.length > 60 ? '...' : ''}\n${input.trim()}`
      : input.trim();
    socket.emit('send_message', {
      fromId: currentUser.id,
      fromName: currentUser.name,
      fromDept: currentUser.department,
      toId: activeRoom === 'general' ? null : activeRoom,
      room: activeRoom,
      content,
    });
    setInput('');
    setReplyTo(null);
    // Stop typing
    socket.emit('typing', { room: activeRoom, name: currentUser.name, isTyping: false });
  }, [input, replyTo, currentUser, connected, activeRoom]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setInput(e.target.value);
    if (!currentUser || !connected) return;
    socket.emit('typing', { room: activeRoom, name: currentUser.name, isTyping: true });
    if (typingTimer) clearTimeout(typingTimer);
    const t = setTimeout(() => {
      socket.emit('typing', { room: activeRoom, name: currentUser.name, isTyping: false });
    }, 1500);
    setTypingTimer(t);
  };

  const roomMessages = messages[activeRoom] ?? [];
  const typingList = (typingUsers[activeRoom] ?? []).filter((n) => n !== currentUser?.name);

  const activeRoomLabel = activeRoom === 'general'
    ? '# 전체 채팅'
    : (() => {
      const parts = activeRoom.replace('dm_', '').split('__');
      const otherId = parts.find((p) => p !== currentUser?.id) ?? '';
      const other = onlineUsers.find((u) => u.id === otherId);
      return other ? `@ ${other.name}` : '@ DM';
    })();

  const otherOnlineUsers = onlineUsers.filter((u) => u.id !== currentUser?.id);

  return (
    <div className="flex h-[calc(100vh-120px)] rounded-xl overflow-hidden border border-gray-200 bg-white shadow-sm">

      {/* Sidebar */}
      <div className="w-60 bg-gray-900 flex flex-col shrink-0">
        {/* Header */}
        <div className="px-4 py-4 border-b border-gray-700">
          <div className="flex items-center justify-between">
            <span className="text-white font-bold text-sm">Office 메신저</span>
            <div className={clsx('flex items-center gap-1 text-xs', connected ? 'text-emerald-400' : 'text-red-400')}>
              {connected ? <Wifi size={12} /> : <WifiOff size={12} />}
              {connected ? '연결됨' : '연결 끊김'}
            </div>
          </div>
        </div>

        {/* Channels */}
        <div className="px-3 pt-4 pb-2">
          <p className="text-gray-400 text-xs font-semibold uppercase tracking-wider px-1 mb-1">채널</p>
          <button
            onClick={() => setActiveRoom('general')}
            className={clsx(
              'w-full flex items-center gap-2 px-2 py-1.5 rounded-md text-sm transition-colors',
              activeRoom === 'general'
                ? 'bg-blue-600 text-white'
                : 'text-gray-300 hover:bg-gray-800'
            )}
          >
            <Hash size={14} />
            전체 채팅
            {(messages['general'] ?? []).length > 0 && (
              <span className="ml-auto text-xs bg-gray-700 text-gray-300 px-1.5 rounded-full">
                {(messages['general'] ?? []).length}
              </span>
            )}
          </button>
        </div>

        {/* DMs */}
        <div className="px-3 pt-2 flex-1 overflow-y-auto">
          <p className="text-gray-400 text-xs font-semibold uppercase tracking-wider px-1 mb-1">다이렉트 메시지</p>
          {otherOnlineUsers.length === 0 ? (
            <p className="text-gray-500 text-xs px-2 py-2">온라인 사용자 없음</p>
          ) : (
            otherOnlineUsers.map((u) => {
              const room = dmRoom(currentUser?.id ?? '', u.id);
              const isActive = activeRoom === room;
              const dmMsgs = messages[room] ?? [];
              return (
                <button
                  key={u.id}
                  onClick={() => handleOpenDM(u)}
                  className={clsx(
                    'w-full flex items-center gap-2 px-2 py-1.5 rounded-md text-sm mb-0.5 transition-colors',
                    isActive ? 'bg-blue-600 text-white' : 'text-gray-300 hover:bg-gray-800'
                  )}
                >
                  <div className="relative shrink-0">
                    <div className="w-6 h-6 rounded-full bg-gray-600 flex items-center justify-center text-xs font-bold text-white">
                      {u.name.charAt(0)}
                    </div>
                    <Circle size={8} className="absolute -bottom-0.5 -right-0.5 text-emerald-400 fill-emerald-400" />
                  </div>
                  <div className="flex-1 text-left min-w-0">
                    <p className="text-xs font-medium truncate">{u.name}</p>
                    <p className={clsx('text-xs truncate', isActive ? 'text-blue-200' : 'text-gray-500')}>{u.department}</p>
                  </div>
                  {dmMsgs.length > 0 && (
                    <span className="text-xs bg-gray-700 text-gray-300 px-1.5 rounded-full shrink-0">
                      {dmMsgs.length}
                    </span>
                  )}
                </button>
              );
            })
          )}
        </div>

        {/* Current user */}
        <div className="px-4 py-3 border-t border-gray-700 flex items-center gap-2">
          <div className="w-7 h-7 rounded-full bg-blue-600 flex items-center justify-center text-white text-xs font-bold shrink-0">
            {currentUser?.name.charAt(0)}
          </div>
          <div className="min-w-0">
            <p className="text-white text-xs font-semibold truncate">{currentUser?.name}</p>
            <p className="text-gray-400 text-xs truncate">{currentUser?.department}</p>
          </div>
          <Circle size={8} className="text-emerald-400 fill-emerald-400 ml-auto shrink-0" />
        </div>
      </div>

      {/* Chat area */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Chat header */}
        <div className="px-5 py-3.5 border-b border-gray-100 flex items-center justify-between bg-white">
          <div className="flex items-center gap-2">
            <MessageCircle size={16} className="text-blue-500" />
            <span className="font-semibold text-gray-800 text-sm">{activeRoomLabel}</span>
          </div>
          <div className="text-xs text-gray-400">
            온라인 {onlineUsers.length}명
          </div>
        </div>

        {/* Messages */}
        <div className="flex-1 overflow-y-auto px-5 py-4 space-y-1 bg-gray-50">
          {roomMessages.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full text-gray-400">
              <MessageCircle size={40} className="mb-3 text-gray-300" />
              <p className="text-sm">첫 메시지를 보내보세요!</p>
            </div>
          ) : (
            (() => {
              const groups: { date: string; msgs: typeof roomMessages }[] = [];
              roomMessages.forEach((msg) => {
                const date = format(new Date(msg.timestamp), 'yyyy년 M월 d일 EEEE', { locale: ko });
                const last = groups[groups.length - 1];
                if (!last || last.date !== date) groups.push({ date, msgs: [msg] });
                else last.msgs.push(msg);
              });
              return groups.map((group) => (
                <div key={group.date}>
                  <div className="flex items-center gap-3 my-4">
                    <div className="flex-1 h-px bg-gray-200" />
                    <span className="text-xs text-gray-400 shrink-0">{group.date}</span>
                    <div className="flex-1 h-px bg-gray-200" />
                  </div>
                  {group.msgs.map((msg, i) => {
                    const isMine = msg.fromId === currentUser?.id;
                    const prev = group.msgs[i - 1];
                    const showHeader = !prev || prev.fromId !== msg.fromId;
                    const msgReactions = reactions[msg.id] ?? {};
                    const isMenuOpen = menuMsgId === msg.id;
                    return (
                      <div
                        key={msg.id}
                        className={clsx('flex items-end gap-2 mb-0.5 group/row', isMine && 'flex-row-reverse')}
                      >
                        {!isMine && showHeader && (
                          <Avatar name={msg.fromName} size={8} />
                        )}
                        {!isMine && !showHeader && <div className="w-8 shrink-0" />}
                        <div className={clsx('max-w-[70%]', isMine && 'items-end', 'flex flex-col')}>
                          {showHeader && !isMine && (
                            <div className="flex items-baseline gap-1.5 mb-0.5 ml-1">
                              <span className="text-xs font-semibold text-gray-700">{msg.fromName}</span>
                              <span className="text-xs text-gray-400">{msg.fromDept}</span>
                            </div>
                          )}
                          <div className="flex items-end gap-1.5 relative" style={{ flexDirection: isMine ? 'row-reverse' : 'row' }}>
                            {/* 말풍선 */}
                            <div
                              onClick={() => setMenuMsgId(isMenuOpen ? null : msg.id)}
                              className={clsx(
                                'px-3.5 py-2.5 rounded-2xl text-sm leading-relaxed whitespace-pre-wrap break-words cursor-pointer select-text',
                                isMine
                                  ? 'bg-blue-500 text-white rounded-br-sm hover:bg-blue-600'
                                  : 'bg-white text-gray-800 shadow-sm rounded-bl-sm hover:bg-gray-50',
                                'transition-colors'
                              )}
                            >
                              {msg.content}
                            </div>
                            <span className="text-xs text-gray-400 shrink-0 mb-0.5">
                              {format(new Date(msg.timestamp), 'HH:mm')}
                            </span>

                            {/* 컨텍스트 메뉴 */}
                            {isMenuOpen && (
                              <div
                                ref={menuRef}
                                className={clsx(
                                  'absolute top-full mt-1 z-50 bg-white rounded-xl shadow-xl border border-gray-100 py-1 min-w-[160px]',
                                  isMine ? 'right-0' : 'left-0'
                                )}
                              >
                                {/* 이모지 반응 */}
                                <div className="flex items-center gap-1 px-2 py-1.5 border-b border-gray-100">
                                  {EMOJIS.map((emoji) => {
                                    const count = (msgReactions[emoji] ?? []).length;
                                    const reacted = (msgReactions[emoji] ?? []).includes(currentUser?.id ?? '');
                                    return (
                                      <button
                                        key={emoji}
                                        onClick={() => handleReact(msg.id, emoji)}
                                        className={clsx(
                                          'text-base w-7 h-7 rounded-lg flex items-center justify-center transition-colors',
                                          reacted ? 'bg-blue-100' : 'hover:bg-gray-100'
                                        )}
                                        title={count > 0 ? `${count}명` : ''}
                                      >
                                        {emoji}
                                      </button>
                                    );
                                  })}
                                </div>
                                {/* 액션 버튼 */}
                                <button
                                  onClick={() => handleCopy(msg.content)}
                                  className="w-full flex items-center gap-2.5 px-3 py-2 text-sm text-gray-700 hover:bg-gray-50"
                                >
                                  <Copy size={13} className="text-gray-400" /> 복사하기
                                </button>
                                <button
                                  onClick={() => handleReply({ id: msg.id, fromName: msg.fromName, content: msg.content })}
                                  className="w-full flex items-center gap-2.5 px-3 py-2 text-sm text-gray-700 hover:bg-gray-50"
                                >
                                  <Reply size={13} className="text-gray-400" /> 답장하기
                                </button>
                                {isMine && (
                                  <button
                                    onClick={() => handleDeleteMsg(msg.id)}
                                    className="w-full flex items-center gap-2.5 px-3 py-2 text-sm text-red-500 hover:bg-red-50"
                                  >
                                    <Trash2 size={13} /> 삭제하기
                                  </button>
                                )}
                              </div>
                            )}
                          </div>

                          {/* 이모지 반응 표시 */}
                          {Object.keys(msgReactions).length > 0 && (
                            <div className={clsx('flex flex-wrap gap-1 mt-1', isMine && 'justify-end')}>
                              {Object.entries(msgReactions).map(([emoji, users]) =>
                                users.length > 0 ? (
                                  <button
                                    key={emoji}
                                    onClick={() => handleReact(msg.id, emoji)}
                                    className={clsx(
                                      'flex items-center gap-1 px-1.5 py-0.5 rounded-full text-xs border transition-colors',
                                      users.includes(currentUser?.id ?? '')
                                        ? 'bg-blue-100 border-blue-300 text-blue-700'
                                        : 'bg-white border-gray-200 text-gray-600 hover:bg-gray-50'
                                    )}
                                  >
                                    {emoji} {users.length}
                                  </button>
                                ) : null
                              )}
                            </div>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              ));
            })()
          )}
          {/* Typing indicator */}
          {typingList.length > 0 && (
            <div className="flex items-center gap-2 px-2 py-1">
              <div className="flex gap-1">
                {[0, 1, 2].map((i) => (
                  <div
                    key={i}
                    className="w-1.5 h-1.5 bg-gray-400 rounded-full animate-bounce"
                    style={{ animationDelay: `${i * 0.15}s` }}
                  />
                ))}
              </div>
              <span className="text-xs text-gray-400">{typingList.join(', ')} 입력중...</span>
            </div>
          )}
          <div ref={messagesEndRef} />
        </div>

        {/* Input */}
        <div className="px-4 py-3 border-t border-gray-100 bg-white">
          {!connected && (
            <div className="mb-2 px-3 py-2 bg-red-50 rounded-lg text-xs text-red-600 flex items-center gap-2">
              <WifiOff size={12} />
              서버에 연결되지 않았습니다. 서버를 실행해주세요: <code className="font-mono bg-red-100 px-1 rounded">node server/index.cjs</code>
            </div>
          )}
          {/* 답장 미리보기 */}
          {replyTo && (
            <div className="mb-2 flex items-start gap-2 px-3 py-2 bg-blue-50 rounded-lg border-l-2 border-blue-400">
              <Reply size={13} className="text-blue-500 mt-0.5 shrink-0" />
              <div className="flex-1 min-w-0">
                <p className="text-xs font-semibold text-blue-600">{replyTo.fromName}에게 답장</p>
                <p className="text-xs text-gray-500 truncate">{replyTo.content}</p>
              </div>
              <button onClick={() => setReplyTo(null)} className="text-gray-400 hover:text-gray-600">
                <X size={13} />
              </button>
            </div>
          )}
          <div className="flex items-end gap-2">
            <textarea
              ref={inputRef}
              value={input}
              onChange={handleInputChange}
              onKeyDown={handleKeyDown}
              placeholder={connected ? `${activeRoomLabel}에 메시지 보내기 (Enter: 전송, Shift+Enter: 줄바꿈)` : '서버 연결 대기중...'}
              disabled={!connected}
              rows={1}
              className="flex-1 resize-none rounded-xl border border-gray-200 px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300 focus:border-transparent disabled:bg-gray-50 disabled:text-gray-400 max-h-32 overflow-y-auto"
              style={{ minHeight: '42px' }}
              onInput={(e) => {
                const t = e.currentTarget;
                t.style.height = 'auto';
                t.style.height = Math.min(t.scrollHeight, 128) + 'px';
              }}
            />
            <button
              onClick={handleSend}
              disabled={!input.trim() || !connected}
              className="w-10 h-10 rounded-xl bg-blue-500 hover:bg-blue-600 disabled:bg-gray-200 disabled:cursor-not-allowed text-white flex items-center justify-center transition-colors shrink-0"
            >
              <Send size={16} />
            </button>
          </div>
        </div>
      </div>

      {/* Online users panel */}
      <div className="w-52 border-l border-gray-100 bg-white flex flex-col shrink-0 hidden xl:flex">
        <div className="px-4 py-3.5 border-b border-gray-100">
          <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">
            온라인 멤버 ({onlineUsers.length})
          </p>
        </div>
        <div className="flex-1 overflow-y-auto px-3 py-3 space-y-1">
          {onlineUsers.map((u) => (
            <button
              key={u.id}
              onClick={() => u.id !== currentUser?.id && handleOpenDM(u)}
              className={clsx(
                'w-full flex items-center gap-2.5 px-2 py-2 rounded-lg text-left transition-colors',
                u.id !== currentUser?.id ? 'hover:bg-gray-50 cursor-pointer' : 'cursor-default'
              )}
            >
              <div className="relative shrink-0">
                <Avatar name={u.name} size={8} />
                <Circle size={8} className="absolute -bottom-0.5 -right-0.5 text-emerald-400 fill-emerald-400" />
              </div>
              <div className="min-w-0">
                <p className="text-xs font-semibold text-gray-800 truncate">
                  {u.name} {u.id === currentUser?.id && <span className="text-gray-400 font-normal">(나)</span>}
                </p>
                <p className="text-xs text-gray-400 truncate">{u.department}</p>
              </div>
            </button>
          ))}
          {onlineUsers.length === 0 && (
            <p className="text-xs text-gray-400 text-center py-4">접속자 없음</p>
          )}
        </div>
      </div>
    </div>
  );
}
