const $ = sel => document.querySelector(sel);

const log = (msg, type = 'info') => {
  const li = document.createElement('li');
  li.textContent = `[${new Date().toLocaleTimeString()}] ${msg}`;
  li.className = type === 'error' ? 'text-red-600' : 'text-gray-600';
  $('#log')?.prepend(li);
};

let textModel, numberModel, imageModel, cocoSsdModel;

async function loadTextModel() {
  textModel = {
    predict: text => {
      const lower = text.toLowerCase();
      const words = text.split(/\s+/).filter(w => w.length > 0);
      
      const patterns = {
        narratif: ['je', 'nous', 'hier', 'raconter', 'suis', 'étais'],
        descriptif: ['beau', 'grand', 'qui', 'que', 'rapidement'],
        argumentatif: ['parce que', 'donc', 'ainsi', 'car', 'cependant'],
        expressif: ['oh', 'ah', 'pleure', 'triste', 'bonheur', 'malheur']
      };
      
      const scores = {};
      Object.keys(patterns).forEach(type => {
        scores[type] = patterns[type].filter(w => lower.includes(w)).length;
      });
      
      const style = Object.keys(scores).reduce((a, b) => scores[b] > scores[a] ? b : a);
      
      const positive = ['bien', 'bon', 'bonheur', 'heureux'];
      const negative = ['mal', 'triste', 'pleure', 'malheur'];
      
      const posCount = positive.filter(w => lower.includes(w)).length;
      const negCount = negative.filter(w => lower.includes(w)).length;
      
      let sentiment = 'neutre';
      if (negCount > posCount) sentiment = 'négatif';
      else if (posCount > negCount) sentiment = 'positif';
      
      return {
        style: scores[style] > 0 ? style : 'neutre',
        confidence: scores[style] > 2 ? 'élevée' : 'moyenne',
        sentiment,
        complexity: words.length > 50 ? 'complexe' : 'simple'
      };
    }
  };
  log('Modèle texte chargé');
}

async function loadNumberModel() {
  numberModel = {
    predict: n => {
      const abs = Math.abs(n);
      let cat = 'moyen';
      
      if (n === 0) cat = 'zéro';
      else if (n < 0) cat = 'négatif';
      else if (abs <= 10) cat = 'petit';
      else if (abs > 1000) cat = 'grand';
      
      const parity = Number.isInteger(n) ? (n % 2 === 0 ? 'pair' : 'impair') : 'décimal';
      
      const isPrime = Number.isInteger(n) && n > 1 && 
        !Array.from({length: Math.floor(Math.sqrt(n)) - 1}, (_, i) => i + 2)
        .some(d => n % d === 0);
      
      const isSquare = Number.isInteger(n) && Math.sqrt(abs) % 1 === 0;
      
      const props = [];
      if (isPrime) props.push('premier');
      if (isSquare) props.push('carré parfait');
      
      return { cat, parity, properties: props.join(', ') || 'aucune' };
    }
  };
  log('Modèle nombre chargé');
}

function analyzeText() {
  const text = $('#userText')?.value.trim();
  const [summary, style, stats] = [('#summary'), ('#writingStyle'), ('#stats')].map($);
  
  if (!text) {
    summary.textContent = 'Saisissez du texte...';
    style.textContent = '—';
    stats.textContent = '—';
    return;
  }
  
  summary.textContent = createSummary(text);
  
  const result = textModel.predict(text);
  style.textContent = `${result.style} (${result.confidence}) - ${result.sentiment}, ${result.complexity}`;
  
  const readTime = Math.ceil(text.split(/\s+/).length / 200);
  stats.textContent = `Lecture: ${readTime}min`;
}

function createSummary(text) {
  const sentences = text.split(/[.!?]+/).filter(s => s.trim());
  if (sentences.length <= 2) return text;
  
  // Prendre les phrases avec le plus de mots importants
  const important = ['je', 'nous', 'donc', 'parce', 'mais', 'qui', 'que'];
  const scored = sentences.map(s => ({
    text: s.trim(),
    score: important.filter(w => s.toLowerCase().includes(w)).length + s.length * 0.01
  }));
  
  scored.sort((a, b) => b.score - a.score);
  return scored.slice(0, 2).map(s => s.text).join('. ') + '.';
}

function analyzeNumber() {
  const v = Number($('#numberInput')?.value);
  const result = $('#numResult');
  
  if (isNaN(v)) {
    result.textContent = 'Nombre invalide';
    result.classList.remove('hidden');
    return;
  }
  
  const analysis = numberModel.predict(v);
  result.textContent = `${analysis.cat} • ${analysis.parity} • ${analysis.properties}`;
  result.classList.remove('hidden');
}



async function loadImageModel() {
  try {
    imageModel = await mobilenet.load();
    log('MobileNet chargé');
    
    cocoSsdModel = await cocoSsd.load();
    log('COCO-SSD chargé');
  } catch (err) {
    log(`Erreur: ${err.message}`, 'error');
  }
}



$('#imageInput')?.addEventListener('change', async e => {
  const file = e.target.files[0];
  if (!file) return;
  
  const img = $('#preview');
  img.src = URL.createObjectURL(file);
  
  img.onload = async () => {
    img.classList.remove('hidden');
    const results = $('#imgResults');
    results.innerHTML = '<div class="text-blue-600">Analyse...</div>';
    
    try {
      // Détection d'objets
      if (cocoSsdModel) {
        const detections = await cocoSsdModel.detect(img);
        if (detections.length > 0) {
          const section = document.createElement('div');
          section.className = 'mb-2 p-2 bg-green-50 rounded';
          section.innerHTML = '<h4 class="font-bold text-green-700">Objets:</h4>';
          
          detections.slice(0, 3).forEach(d => {
            const line = document.createElement('div');
            line.textContent = `${d.class} (${(d.score * 100).toFixed(0)}%)`;
            section.appendChild(line);
          });
          results.innerHTML = '';
          results.appendChild(section);
        }
      }
      
      // Classification
      const preds = await imageModel.classify(img);
      const section = document.createElement('div');
      section.innerHTML = '<h4 class="font-bold text-blue-700">Classification:</h4>';
      
      preds.slice(0, 3).forEach(p => {
        const line = document.createElement('div');
        const name = p.className.split(',')[0];
        line.textContent = `${name} (${(p.probability * 100).toFixed(0)}%)`;
        section.appendChild(line);
      });
      
      if (!cocoSsdModel) results.innerHTML = '';
      results.appendChild(section);
      
    } catch (err) {
      results.innerHTML = '<div class="text-red-600">Erreur d\'analyse</div>';
      log(`Image: ${err.message}`, 'error');
    }
  };
});

$('#analyzeNumberBtn')?.addEventListener('click', analyzeNumber);
$('#userText')?.addEventListener('input', analyzeText);

(async () => {
  await Promise.all([loadTextModel(), loadNumberModel(), loadImageModel()]);
})();
