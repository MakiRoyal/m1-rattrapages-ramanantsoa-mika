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

function preprocessImage(img) {
  const canvas = document.createElement('canvas');
  const ctx = canvas.getContext('2d');
  

  const size = Math.min(512, Math.max(img.naturalWidth, img.naturalHeight));
  canvas.width = canvas.height = size;
  
  // Fond blanc pour meilleur contraste
  ctx.fillStyle = '#FFFFFF';
  ctx.fillRect(0, 0, size, size);
  

  const scale = Math.min(size / img.naturalWidth, size / img.naturalHeight) * 0.9;
  const w = img.naturalWidth * scale;
  const h = img.naturalHeight * scale;
  const x = (size - w) / 2;
  const y = (size - h) / 2;
  
  ctx.drawImage(img, x, y, w, h);
  

  const imageData = ctx.getImageData(0, 0, size, size);
  const data = imageData.data;
  
  for (let i = 0; i < data.length; i += 4) {
    const r = data[i], g = data[i + 1], b = data[i + 2];
    
    // Amélioration adaptative du contraste
    const luminance = 0.299 * r + 0.587 * g + 0.114 * b;
    const factor = luminance < 128 ? 1.2 : 1.1;
    const boost = luminance < 80 ? 10 : 0;
    
    data[i] = Math.min(255, Math.max(0, (r - 128) * factor + 128 + boost));
    data[i + 1] = Math.min(255, Math.max(0, (g - 128) * factor + 128 + boost));
    data[i + 2] = Math.min(255, Math.max(0, (b - 128) * factor + 128 + boost));
  }
  
  ctx.putImageData(imageData, 0, 0);
  return canvas;
}

function enhanceResults(detections, classifications) {
  // Améliorer les détections d'objets
  const enhancedDetections = detections
    .filter(d => d.score > 0.2)
    .map(d => {

      const commonObjects = ['person', 'car', 'dog', 'cat', 'phone', 'laptop', 'book'];
      const boost = commonObjects.includes(d.class.toLowerCase()) ? 1.15 : 1;
      return { ...d, score: Math.min(1, d.score * boost) };
    })
    .sort((a, b) => b.score - a.score);
  

  const enhancedClassifications = classifications
    .filter(p => p.probability > 0.05)
    .map(p => {
      const mainName = p.className.split(',')[0].trim();

      const boost = mainName.length > 3 ? 1.05 : 1;
      return { 
        className: mainName, 
        probability: Math.min(1, p.probability * boost) 
      };
    })
    .sort((a, b) => b.probability - a.probability);
  
  return { enhancedDetections, enhancedClassifications };
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
    results.innerHTML = '<div class="text-blue-600">🔍 Analyse approfondie...</div>';
    
    try {

      const enhancedCanvas = preprocessImage(img);
      
      // Analyse sur image originale et améliorée
      const [originalDetections, enhancedDetections, originalPreds, enhancedPreds] = await Promise.all([
        cocoSsdModel ? cocoSsdModel.detect(img) : Promise.resolve([]),
        cocoSsdModel ? cocoSsdModel.detect(enhancedCanvas) : Promise.resolve([]),
        imageModel.classify(img),
        imageModel.classify(enhancedCanvas)
      ]);
      

      const allDetections = [...originalDetections, ...enhancedDetections];
      const allPreds = [...originalPreds, ...enhancedPreds];
      const { enhancedDetections: finalDetections, enhancedClassifications: finalClassifications } = 
        enhanceResults(allDetections, allPreds);
      
      results.innerHTML = '';
      

      if (finalDetections.length > 0) {
        const detectionSection = document.createElement('div');
        detectionSection.className = 'mb-3 p-3 bg-green-50 rounded-lg border border-green-200';
        detectionSection.innerHTML = '<h4 class="font-bold text-green-700 mb-2">🎯 Objets détectés:</h4>';
        
        finalDetections.slice(0, 3).forEach(d => {
          const confidence = (d.score * 100).toFixed(1);
          const line = document.createElement('div');
          line.className = 'flex justify-between items-center mb-1 p-1';
          line.innerHTML = `
            <span class="font-medium capitalize">${d.class}</span>
            <div class="flex items-center">
              <div class="w-20 h-2 bg-gray-200 rounded mr-2">
                <div class="h-full bg-green-500 rounded transition-all" style="width: ${Math.max(5, confidence)}%"></div>
              </div>
              <span class="text-sm font-mono text-gray-700">${confidence}%</span>
            </div>
          `;
          detectionSection.appendChild(line);
        });
        results.appendChild(detectionSection);
      }
      

      const classificationSection = document.createElement('div');
      classificationSection.className = 'p-3 bg-blue-50 rounded-lg border border-blue-200';
      classificationSection.innerHTML = '<h4 class="font-bold text-blue-700 mb-2">🏷️ Classification:</h4>';
      
      finalClassifications.slice(0, 3).forEach(p => {
        const confidence = (p.probability * 100).toFixed(1);
        const line = document.createElement('div');
        line.className = 'flex justify-between items-center mb-1 p-1';
        line.innerHTML = `
          <span class="font-medium">${p.className}</span>
          <div class="flex items-center">
            <div class="w-20 h-2 bg-gray-200 rounded mr-2">
              <div class="h-full bg-blue-500 rounded transition-all" style="width: ${Math.max(5, confidence)}%"></div>
            </div>
            <span class="text-sm font-mono text-gray-700">${confidence}%</span>
          </div>
        `;
        classificationSection.appendChild(line);
      });
      results.appendChild(classificationSection);
      

      const mainObject = finalClassifications[0]?.className || finalDetections[0]?.class || 'objet non identifié';
      const totalObjects = finalDetections.length;
      const bestConfidence = Math.max(
        finalDetections[0]?.score * 100 || 0,
        finalClassifications[0]?.probability * 100 || 0
      ).toFixed(0);
      
      const summarySection = document.createElement('div');
      summarySection.className = 'mt-3 p-3 bg-gray-100 rounded-lg border-l-4 border-gray-500';
      summarySection.innerHTML = `
        <div class="text-sm text-gray-700">
          <span class="font-semibold">📊 Analyse:</span> 
          <span class="text-gray-900">${mainObject}</span> identifié avec 
          <span class="font-medium text-blue-600">${totalObjects} objet(s)</span> détecté(s)
          <br>
          <span class="text-xs text-gray-500">Confiance maximale: ${bestConfidence}% • Analyse multi-modèles</span>
        </div>
      `;
      results.appendChild(summarySection);
      
    } catch (err) {
      results.innerHTML = '<div class="text-red-600 p-3 bg-red-50 rounded">❌ Erreur lors de l\'analyse</div>';
      log(`Image: ${err.message}`, 'error');
    }
  };
});

$('#analyzeNumberBtn')?.addEventListener('click', analyzeNumber);
$('#userText')?.addEventListener('input', analyzeText);

(async () => {
  await Promise.all([loadTextModel(), loadNumberModel(), loadImageModel()]);
})();
