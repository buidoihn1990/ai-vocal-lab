const wave=document.getElementById('wave');
for(let i=0;i<40;i++){
  const b=document.createElement('span');
  b.className='bar';
  b.style.setProperty('--h',(10+((i*13)%38))+'px');
  wave.appendChild(b);
}

const songs=[
  ['Ánh sáng và bóng tối','AI Music','05:37'],
  ['Synthetic Heart','Neo Soul','04:21'],
  ['Cosmic Memories','Ambient R&B','03:48'],
  ['Echoes of You','Dream Pop','03:15'],
  ['Digital Paradise','Electronic','03:59']
];

const list=document.getElementById('releaseList');
songs.forEach((s,i)=>{
  const el=document.createElement('div');
  el.className='release';
  el.innerHTML=`<span>${String(i+1).padStart(2,'0')}</span><span class="thumb"></span><b>${s[0]}</b><span class="hide-sm">AI Vocal Lab</span><span class="hide-sm">${s[1]}</span><span>${s[2]}</span><span class="play-link" data-index="${i}">Play</span>`;
  list.appendChild(el);
});

const toast=msg=>{
  const t=document.getElementById('toast');
  t.textContent=msg;
  t.classList.add('show');
  setTimeout(()=>t.classList.remove('show'),1800);
};

const audio=document.getElementById('audioPlayer');
const playBtn=document.getElementById('playBtn');
const listenBtn=document.getElementById('listenBtn');

function syncPlayButton(){
  const paused=audio.paused;
  playBtn.textContent=paused?'▶':'Ⅱ';
  listenBtn.textContent=paused?'▶ Listen Now':'Ⅱ Pause';
}

async function toggleAudio(){
  try{
    if(audio.paused){
      await audio.play();
    }else{
      audio.pause();
    }
    syncPlayButton();
  }catch(err){
    toast('Chưa tìm thấy file audio/anh-sang-va-bong-toi.mp3');
  }
}

playBtn.onclick=toggleAudio;
listenBtn.onclick=toggleAudio;
audio.addEventListener('play',syncPlayButton);
audio.addEventListener('pause',syncPlayButton);
audio.addEventListener('ended',syncPlayButton);

document.getElementById('prevBtn').onclick=()=>{
  audio.currentTime=Math.max(0,audio.currentTime-10);
};
document.getElementById('nextBtn').onclick=()=>{
  audio.currentTime=Math.min(audio.duration||audio.currentTime+10,audio.currentTime+10);
};

document.querySelectorAll('.play-link').forEach(x=>x.onclick=()=>{
  if(x.dataset.index==='0') toggleAudio();
  else toast('Bài này chưa có file âm thanh');
});

const menu=document.getElementById('mobileMenu');
document.getElementById('menuBtn').onclick=()=>menu.classList.toggle('open');
menu.querySelectorAll('a').forEach(a=>a.onclick=()=>menu.classList.remove('open'));

document.getElementById('emailForm').onsubmit=e=>{
  e.preventDefault();
  toast('Email form demo is working');
  e.target.reset();
};