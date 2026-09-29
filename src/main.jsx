import React,{useEffect,useRef,useState}from'react';
import{createRoot}from'react-dom/client';
import{Send,Plus,Settings,MessageCircle,Wifi,WifiOff,LogOut}from'lucide-react';
import'./styles.css';

const API_URL=import.meta.env.VITE_GREEN_API_URL||'https://3100.api.green-api.com/';
const api=(base,i,method,t)=>base.replace(/\/+$/,'')+'/v3/waInstance'+i+'/'+method+'/'+t;
const norm=v=>String(v??'').replace(/\D/g,'');

async function readJson(response){
  const raw=await response.text();
  let data=null;
  try{data=raw?JSON.parse(raw):null}catch{}
  if(!response.ok){
    throw Error(data?.description||data?.message||'Ошибка GREEN-API');
  }
  return data;
}

function App(){
  const[id,setId]=useState(sessionStorage.getItem('idInstance')||'');
  const[token,setToken]=useState(sessionStorage.getItem('apiTokenInstance')||'');
  const[connected,setConnected]=useState(!!sessionStorage.getItem('idInstance')&&!!sessionStorage.getItem('apiTokenInstance'));
  const[phone,setPhone]=useState('');
  const[chat,setChat]=useState(null);
  const[draft,setDraft]=useState('');
  const[messages,setMessages]=useState([]);
  const[busy,setBusy]=useState(false);
  const[error,setError]=useState('');
  const[account,setAccount]=useState(null);
  const timer=useRef(null);
  const ready=connected&&id&&token;

  const configureNotifications=async()=>{
    const settings=await readJson(await fetch(api(API_URL,id,'getSettings',token)));
    const needsIncoming=settings?.incomingWebhook!=='yes';
    const needsOutgoing=settings?.outgoingMessageWebhook!=='yes';
    const needsOutgoingApi=settings?.outgoingAPIMessageWebhook!=='yes';

    if(needsIncoming||needsOutgoing||needsOutgoingApi){
      await readJson(await fetch(api(API_URL,id,'setSettings',token),{
        method:'POST',
        headers:{'Content-Type':'application/json'},
        body:JSON.stringify({
          webhookUrl:'',
          incomingWebhook:'yes',
          outgoingMessageWebhook:'yes',
          outgoingAPIMessageWebhook:'yes'
        })
      }));
      return true;
    }
    return false;
  };

  const connect=async()=>{
    setError('');
    setBusy(true);
    try{
      const state=await readJson(await fetch(api(API_URL,id.trim(), 'getStateInstance',token.trim())));
      if(state?.stateInstance!=='authorized'){
        throw Error('Инстанс не авторизован. Авторизуйте его в GREEN-API.');
      }

      sessionStorage.setItem('idInstance',id.trim());
      sessionStorage.setItem('apiTokenInstance',token.trim());

      const accountData=await readJson(await fetch(api(API_URL,id.trim(),'getAccountSettings',token.trim())));
      setAccount(accountData);

      await configureNotifications();

      setConnected(true);
    }catch(e){
      setError(e.message||'Ошибка подключения');
    }finally{
      setBusy(false);
    }
  };

  const logout=()=>{
    sessionStorage.clear();
    setConnected(false);
    setChat(null);
    setAccount(null);
    setMessages([]);
  };

  const createChat=()=>{
    const p=norm(phone);
    if(p.length<7){
      setError('Введите корректный номер телефона');
      return;
    }
    setError('');
    const selfPhone=norm(account?.phone);
    const selfChatId=account?.chatId&&p===selfPhone?account.chatId:null;
    setChat({id:selfChatId||p+'@c.us',phone:p});
    setMessages([]);
  };

  const send=async()=>{
    if(!draft.trim()||!chat)return;
    const text=draft.trim();
    setDraft('');
    setBusy(true);
    setError('');
    try{
      const d=await readJson(await fetch(api(API_URL,id,'sendMessage',token),{
        method:'POST',
        headers:{'Content-Type':'application/json'},
        body:JSON.stringify({chatId:chat.id,message:text})
      }));

      setMessages(m=>m.concat([{
        id:d?.idMessage||String(Date.now()),
        text,
        fromMe:true,
        time:new Date()
      }]));
    }catch(e){
      setDraft(text);
      setError(e.message||'Ошибка отправки');
    }finally{
      setBusy(false);
    }
  };

  useEffect(()=>{
    if(!ready||!chat)return;
    let stopped=false;

    const poll=async()=>{
      if(stopped)return;

      try{
        const response=await fetch(
          api(API_URL,id,'receiveNotification',token)+'?receiveTimeout=5'
        );

        const raw=await response.text();
        if(raw.trim()){
          const n=JSON.parse(raw);
          const b=n?.body||{};
          const senderData=b?.senderData||{};
          const messageData=b?.messageData||{};
          const notificationType=b?.typeWebhook||'';
          const senderChatId=senderData?.chatId;
          const senderPhone=norm(senderData?.senderPhoneNumber);
          const text=
            messageData?.textMessageData?.textMessage||
            messageData?.extendedTextMessageData?.text||
            messageData?.textMessage;

          const sameChat=
            senderChatId===chat.id||
            (senderPhone&&senderPhone===norm(chat.phone));

          if(sameChat&&text){
            setChat(current=>current&&senderChatId&&current.id!==senderChatId
              ?{...current,id:senderChatId}
              :current
            );

            setMessages(current=>{
              const messageId=n?.body?.idMessage||n?.receiptId;
              if(current.some(x=>x.id===messageId))return current;

              const fromMe=
                notificationType==='outgoingMessageReceived'||
                notificationType==='outgoingAPIMessageReceived';

              return current.concat([{
                id:messageId,
                text,
                fromMe,
                time:new Date()
              }]);
            });
          }

          if(n?.receiptId!==undefined){
            await fetch(
              api(API_URL,id,'deleteNotification',token)+'/'+n.receiptId,
              {method:'DELETE'}
            );
          }
        }
      }catch(e){
        // Polling errors are transient; the next long-poll attempt retries automatically.
      }

      if(!stopped)timer.current=setTimeout(poll,250);
    };

    poll();

    return()=>{
      stopped=true;
      clearTimeout(timer.current);
    };
  },[ready,chat,id,token]);

  if(!ready)return <div className="auth"><div className="card">
    <div className="brand"><MessageCircle/>MAX Chat</div>
    <h1>Подключение</h1>
    <p>Введите данные GREEN-API для начала работы.</p>
    <label>idInstance
      <input value={id} onChange={e=>setId(e.target.value)} placeholder="3100..."/>
    </label>
    <label>apiTokenInstance
      <input type="password" value={token} onChange={e=>setToken(e.target.value)} placeholder="••••••••"/>
    </label>
    {error&&<div className="error">{error}</div>}
    <button className="primary wide" onClick={connect} disabled={busy||!id||!token}>
      {busy?'Проверяем…':'Войти'}
    </button>
  </div></div>;

  return <div className="app">
    <aside>
      <div className="sideHead">
        <div className="brand"><MessageCircle/>MAX Chat</div>
        <button className="ghost"><Settings/></button>
      </div>
      <button className="new" onClick={()=>{setChat(null);setPhone('');setError('')}}><Plus/>Новый чат</button>
      {chat&&<div className="chatItem">
        <div className="avatar">{chat.phone.slice(-2)}</div>
        <div><b>+{chat.phone}</b><small>Текстовый чат</small></div>
      </div>}
      <div className="foot">
        <span>{connected?<><Wifi/> Подключено</>:<><WifiOff/> Отключено</>}</span>
        <button onClick={logout}><LogOut/></button>
      </div>
    </aside>

    <main>
      {!chat?<div className="empty">
        <MessageCircle/><h2>Новый чат</h2>
        <p>Введите номер телефона получателя.</p>
        <div className="newChat">
          <input value={phone} onChange={e=>setPhone(e.target.value)} onKeyDown={e=>e.key==='Enter'&&createChat()} placeholder="79991234567"/>
          <button className="primary" onClick={createChat}>Создать</button>
        </div>
        {error&&<div className="error">{error}</div>}
      </div>:<>
        <header>
          <div className="avatar">{chat.phone.slice(-2)}</div>
          <div><b>+{chat.phone}</b><small>MAX · текстовые сообщения</small></div>
        </header>

        <section className="messages">
          {messages.length===0
            ?<div className="hint">Сообщений пока нет. Напишите первое сообщение.</div>
            :messages.map(m=><div className={'bubble '+(m.fromMe?'mine':'theirs')} key={m.id}>
              {m.text}
              <span>{m.time.toLocaleTimeString([],{hour:'2-digit',minute:'2-digit'})}</span>
            </div>)
          }
        </section>

        <div className="composer">
          {error&&<div className="error">{error}</div>}
          <div className="compose">
            <textarea
              value={draft}
              onChange={e=>setDraft(e.target.value)}
              onKeyDown={e=>{if(e.key==='Enter'&&!e.shiftKey){e.preventDefault();send()}}}
              placeholder="Напишите сообщение…"
              rows="1"
            />
            <button className="send" onClick={send} disabled={!draft.trim()||busy}><Send/></button>
          </div>
        </div>
      </>}
    </main>
  </div>;
}

createRoot(document.getElementById('root')).render(<App/>);
