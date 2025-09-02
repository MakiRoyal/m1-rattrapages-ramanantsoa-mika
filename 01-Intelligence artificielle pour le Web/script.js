const $ = (sel) => document.querySelector(sel);


const log = (msg, type='info')=>{
  const li = document.createElement('li');
  li.textContent = `[${new Date().toLocaleTimeString()}] ${msg}`;
  li.className = type==='error'?'text-red-600':'text-gray-600';
  $('#log')?.prepend(li);
};


function analyzeText(){
  const text = $('#userText')?.value.trim();
  const summaryEl = $('#summary'),
        styleEl = $('#writingStyle'),
        ideasEl = $('#aiContent'),
        statsEl = $('#stats');
  if(!summaryEl || !styleEl || !ideasEl || !statsEl) return;

  if(!text){
    summaryEl.textContent = 'Saisissez du texte pour générer un résumé.';
    styleEl.textContent = '—';
    ideasEl.textContent = 'Saisissez du texte pour générer des idées.';
    statsEl.textContent = '—';
    return;
  }


  const sentences = text.split(/[.!?]+/).map(s=>s.trim()).filter(Boolean);
  sentences.sort((a,b)=>b.split(' ').length - a.split(' ').length);
  summaryEl.textContent = sentences.slice(0,2).join('. ') + '.';

  
  const lower = text.toLowerCase();
  let score = {narratif:0, descriptif:0, argumentatif:0, explicatif:0};

  ['je','nous','il','elle','ils','elles'].forEach(w=>{if(lower.includes(w)) score.narratif++});
  ['beau','grand','petit','joli','ancien','nouveau','bleu','rouge'].forEach(w=>{if(lower.includes(w)) score.descriptif++});
  ['parce que','donc','il faut','car','puisque'].forEach(w=>{if(lower.includes(w)) score.argumentatif++});
  ['expliquer','décrire','montrer','informer'].forEach(w=>{if(lower.includes(w)) score.explicatif++});

  const maxType = Object.keys(score).reduce((a,b)=>score[b]>score[a]?b:a,'narratif');
  styleEl.textContent = score[maxType]>0 ? maxType.charAt(0).toUpperCase() + maxType.slice(1) : 'Indéterminé';

  
  const ideas = [
    "Ajoutez un exemple concret pour illustrer.",
    "Reformulez pour plus de clarté.",
    "Variez les mots pour enrichir le style.",
    "Transformez ce texte en mini-histoire.",
    "Rendez le texte plus descriptif."
  ];
  ideasEl.textContent = ideas[Math.floor(Math.random()*ideas.length)];

  
  const words = text.split(/\s+/).length;
  statsEl.textContent = `Mots: ${words} | Phrases: ${sentences.length}`;
}


let imageModel = null;
async function loadImageModel(){
  try{
    imageModel = await mobilenet.load();
    log('Modèle MobileNet chargé');
  }catch(err){ log('Erreur chargement MobileNet – '+err.message,'error'); }
}

$('#imageInput')?.addEventListener('change', async e=>{
  const file = e.target.files?.[0]; if(!file) return;
  const img = $('#preview'); img.src = URL.createObjectURL(file);
  img.onload = async ()=>{
    img.classList.remove('hidden');
    const resultsBox = $('#imgResults'); if(!resultsBox) return;
    resultsBox.innerHTML='';
    try{
      if(!imageModel) throw new Error('Modèle non prêt');
      const preds = await imageModel.classify(img);
      preds.slice(0,3).forEach(p=>{
        const line = document.createElement('div');
        line.textContent = `${p.className} (${(p.probability*100).toFixed(1)}%)`;
        resultsBox.appendChild(line);
      });
    }catch(err){
      resultsBox.innerHTML='<p class="text-red-600">Impossible de classer l\'image.</p>';
      log('Classification image – '+err.message,'error');
    }
  };
});


function analyzeNumber(){
  const v = Number($('#numberInput')?.value);
  const resultBox = $('#numResult'); if(!resultBox) return;

  if(Number.isNaN(v)){
    resultBox.textContent='Entrez un nombre valide';
    resultBox.classList.remove('hidden');
    return;
  }

  let cat='moyen';
  if(v<0) cat='négatif';
  else if(v<=10) cat='petit';
  else if(v>1000) cat='très grand';
  else if(v>100) cat='grand';

  const isInt = Number.isInteger(v);
  const parity = isInt?(v%2===0?'pair':'impair'):'non entier';
  const prime = isInt && v>1 && Array.from({length:Math.floor(Math.sqrt(v))-1},(_,i)=>i+2).every(d=>v%d!==0);

  const out = `Catégorie: ${cat}\n• Parité: ${parity}${isInt?`\n• Premier: ${prime?'oui':'non'}`:''}`;
  resultBox.textContent = out;
  resultBox.classList.remove('hidden');
}


$('#analyzeNumberBtn')?.addEventListener('click', analyzeNumber);
$('#userText')?.addEventListener('input', analyzeText);
(async function boot(){ await loadImageModel(); })();
