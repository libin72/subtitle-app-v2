"use client";

import React, { useState, useEffect, useRef } from 'react';
import { upload } from '@vercel/blob/client';
import { 
  Upload, FileAudio, Play, Pause, ChevronLeft, 
  CheckCircle, Loader2, Download, Edit3, Clock, 
  Mic, MessageSquare, ImagePlus, Scissors, ArrowUp, Eye, Image as ImageIcon, Video,
  ToggleLeft, ToggleRight, Save, FolderOpen, X,
  BookOpen, Sparkles, CheckSquare, Square, Home, Globe, MonitorPlay,
  Trash2, Plus, LayoutDashboard, Search
} from 'lucide-react';

function CrossfadeImage({ src }) {
  const [images, setImages] = useState([src]);

  useEffect(() => {
    if (src && src !== images[images.length - 1]) {
      setImages((prev) => [...prev.slice(-1), src]);
    }
  }, [src]);

  return (
    <div className="relative w-full h-full flex-shrink-0 overflow-hidden bg-black">
      {images.map((imgSrc, idx) => (
        <img
          key={`${imgSrc}-${idx}`}
          src={imgSrc}
          alt="Visual Context"
          className={`absolute inset-0 w-full h-full object-cover transition-opacity duration-700 ease-in-out ${idx === images.length - 1 ? 'opacity-100' : 'opacity-0'}`} />
      ))}
    </div>
  );
}

const buildSubtitleStructures = (allWords) => {
    const abbrs = ["u.s.", "u.k.", "mr.", "mrs.", "dr.", "ms.", "prof.", "inc.", "ltd.", "st.", "vs.", "i.e.", "e.g.", "a.m.", "p.m."];
    const isAbbr = (w) => abbrs.includes(w.toLowerCase()) || /^[a-z]\.$/i.test(w);

    let sentences = [];
    let curSentenceWords = [];
    
    allWords.forEach((wObj, i) => {
        curSentenceWords.push(wObj);
        const wText = wObj.word.trim();
        const nextGap = i < allWords.length - 1 ? allWords[i+1].start - wObj.end : 0;
        
        const isStrongPunct = /[.?!。？！"”]['"]*$/.test(wText) && !isAbbr(wText);
        const isLongGap = nextGap > 1.5 && curSentenceWords.length >= 3; 
        
        if (isStrongPunct || isLongGap || i === allWords.length - 1) {
            sentences.push({ words: [...curSentenceWords] });
            curSentenceWords = [];
        }
    });

    let parsedSentences = [];
    sentences.forEach((sentData, sIdx) => {
        let chunks = [];
        let curChunkWords = [];
        let sentWords = sentData.words;
        
        for (let i = 0; i < sentWords.length; i++) {
            curChunkWords.push(sentWords[i]);
            const wText = sentWords[i].word.trim();
            const isWeakPunct = /[,;，；]['"]*$/.test(wText);
            const remainingWords = sentWords.length - 1 - i;
            
            let forceSplit = false;
            if (i === sentWords.length - 1) {
                forceSplit = true;
            } else if (curChunkWords.length >= 20) {
                forceSplit = true;
            } else if (curChunkWords.length >= 12 && isWeakPunct && remainingWords >= 4) {
                forceSplit = true; 
            }
            
            if (forceSplit) {
                chunks.push({
                    id: `c_${sIdx}_${chunks.length}`,
                    en: curChunkWords.map(w => w.word).join(" ").replace(/\s+([.,?!;])/g, "$1"),
                    start: curChunkWords[0].start,
                    end: curChunkWords[curChunkWords.length - 1].end,
                    words: curChunkWords
                });
                curChunkWords = [];
            }
        }
        if (chunks.length > 0) {
            parsedSentences.push({
                id: `s_${sIdx}_${Date.now()}`,
                blockId: `block-0`, 
                en: sentWords.map(w => w.word).join(" ").replace(/\s+([.,?!;])/g, "$1"),
                zh: "",
                chunks: chunks
            });
        }
    });
    return parsedSentences;
};

const splitChineseText = (text) => {
    if (!text) return [];
    const chunks = [];
    let currentChunk = "";
    for (let i = 0; i < text.length; i++) {
        currentChunk += text[i];
        if (currentChunk.length >= 30 && /[。？！”’，；、\n]/.test(text[i])) {
            chunks.push(currentChunk.trim());
            currentChunk = "";
        }
    }
    if (currentChunk.trim().length > 0) chunks.push(currentChunk.trim());
    return chunks;
};

const delay = (ms) => new Promise(resolve => setTimeout(resolve, ms));

export default function App() {
  const [isEnSourceRaw, setIsEnSourceRaw] = useState(false);
  const [formData, setFormData] = useState({ id: null, title: '新建音频字幕项目', audioFile: null, audioName: '', audioUrl: '', audioDuration: 0, rawText: '' });
  const [sentences, setSentences] = useState([]);
  const [blocks, setBlocks] = useState([]); 
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [isProcessing, setIsProcessing] = useState(false);
  const [processMsg, setProcessMsg] = useState("");
  const [newsDate, setNewsDate] = useState('');
  const [isExportingVideo, setIsExportingVideo] = useState(false);
  const [exportProgress, setExportProgress] = useState(0);
  
  // === 双模切换状态 ===
  const [appMode, setAppMode] = useState('portal'); 
  const [portalView, setPortalView] = useState('home'); 
  const [readingLang, setReadingLang] = useState('en'); 
  
  // === 新增：后台专用的视图路由 ===
  const [studioView, setStudioView] = useState('dashboard'); // 'dashboard' (控制台) | 'create' (新建页) | 'workspace' (打轴编辑页)
  const [searchQuery, setSearchQuery] = useState(''); // 用于 Dashboard 搜索过滤

  // === 草稿箱相关状态 ===
  const [projectList, setProjectList] = useState([]);
  const [showList, setShowList] = useState(false);
  const [isLoadingList, setIsLoadingList] = useState(false);

  // === 词汇课研实验室状态 ===
  const [showVocabLab, setShowVocabLab] = useState(false);
  const [vocabPhase, setVocabPhase] = useState('select'); 
  const [isVocabLoading, setIsVocabLoading] = useState(false);
  const [candidateWords, setCandidateWords] = useState([]);
  const [selectedWords, setSelectedWords] = useState([]);
  const [vocabCards, setVocabCards] = useState([]);

  const audioRef = useRef(null);
  const exportCanvasRef = useRef(null);
  const imageElementCache = useRef({}); 

  const getFormattedDate = () => {
    const date = new Date();
    return date.toLocaleDateString('zh-CN', { year: 'numeric', month: 'long', day: 'numeric', weekday: 'long' });
  };

  useEffect(() => {
    fetchProjects(); // 初始化拉取草稿箱
  }, []);

  useEffect(() => {
    blocks.forEach(b => {
        if (b.image && !imageElementCache.current[b.image]) {
            const img = new Image(); img.crossOrigin = "anonymous"; img.src = b.image; imageElementCache.current[b.image] = img;
        }
    });
  }, [blocks]);

// 导出 SRT 功能函数
  const handleExportSRT = (project: any) => {
    // 1. 检查有没有句子数据
    if (!project.sentences || project.sentences.length === 0) {
      alert("这篇内容暂时没有句子时间轴数据，无法导出 SRT 喔！");
      return;
    }

    // 2. 时间格式化工具 (将秒数转为 SRT 要求的 HH:MM:SS,mmm 格式)
    const formatTime = (timeInSeconds: number) => {
      const date = new Date(timeInSeconds * 1000);
      const hh = String(date.getUTCHours()).padStart(2, '0');
      const mm = String(date.getUTCMinutes()).padStart(2, '0');
      const ss = String(date.getUTCSeconds()).padStart(2, '0');
      const ms = String(date.getUTCMilliseconds()).padStart(3, '0');
      return `${hh}:${mm}:${ss},${ms}`;
    };

    // 3. 拼接 SRT 文本
    let srtContent = "";
    project.sentences.forEach((sentence: any, index: number) => {
      const startTime = formatTime(sentence.startTime || 0);
      const endTime = formatTime(sentence.endTime || 0);
      
      srtContent += `${index + 1}\n`;
      srtContent += `${startTime} --> ${endTime}\n`;
      srtContent += `${sentence.text}\n\n`; // 注意这里有两个换行
    });

    // 4. 触发浏览器下载
    const blob = new Blob([srtContent], { type: "text/plain;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${project.title || "kizenglish-subtitle"}.srt`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url); // 释放内存
  };
  const fetchProjects = async () => {
    setIsLoadingList(true);
    try {
      const res = await fetch('/api/project/list');
      const data = await res.json();
      if (data.success) {
        setProjectList(data.projects.sort((a,b) => new Date(b.updatedAt) - new Date(a.updatedAt)));
      }
    } catch (err) {
      console.error('获取列表失败', err);
    } finally {
      setIsLoadingList(false);
    }
  };

  const loadProject = async (id) => {
    try {
      const res = await fetch(`/api/project/get?id=${id}`);
      const data = await res.json();
      if (data.success) {
        const p = data.project;
        
        // 💡 修复进度条为 0: 强制重置时间并清空旧的持续时间
        setCurrentTime(0);
        setFormData(prev => ({
          ...prev, id: p.id, title: p.title || '已恢复草稿', audioName: p.audioName || '', audioUrl: p.audioUrl || '', rawText: p.rawText || '', audioDuration: 0
        }));
        
        setNewsDate(p.newsDate || '');
        setBlocks(typeof p.blocks === 'string' ? JSON.parse(p.blocks) : (p.blocks || []));
        setSentences(typeof p.sentences === 'string' ? JSON.parse(p.sentences) : (p.sentences || []));
        setShowList(false);

        if (appMode === 'portal') {
            setPortalView('detail');
        } else {
          setStudioView('workspace');
          alert(`✅ 成功加载项目：${p.title}`);
        }
      }
    } catch (err) {
      alert('加载失败，请重试');
    }
  };

  // === 1. 保存项目引擎 ===
  const handleSaveProject = async () => {
    if (sentences.length === 0) return alert("无可保存的内容，请先解析音频生成剧本！");
    
    let finalAudioUrl = formData.audioUrl;
    
    // 💡 核心补丁：如果当前音频是新上传的本地临时文件，强行将其上传至云端转为永久链接
    if (formData.audioFile && finalAudioUrl && finalAudioUrl.startsWith('blob:')) {
        try {
            alert("即将把音频同步至全球 CDN 云端，大概需要几秒钟，请点击确定并在稍后留意成功提示。");
            setIsProcessing(true); 
            // 💡 修复解析遇阻: 增加 addRandomSuffix
            const blobResult = await upload(`audio_${Date.now()}_${formData.audioName}`, formData.audioFile, { 
                access: 'public', 
                handleUploadUrl: '/api/upload',
            });
            finalAudioUrl = blobResult.url;
            setFormData(prev => ({ ...prev, audioUrl: finalAudioUrl }));
            setIsProcessing(false);
        } catch (error) {
            setIsProcessing(false);
            return alert("音频云端同步失败，无法保存，请检查网络！");
        }
    }

    try {
      const res = await fetch('/api/project/save', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: formData.id, title: formData.title, audioName: formData.audioName, audioUrl: finalAudioUrl, 
          rawText: formData.rawText, newsDate: newsDate, blocks: blocks, sentences: sentences
        })
      });
      const data = await res.json();
      if (data.success) {
        setFormData(prev => ({...prev, id: data.project.id, audioUrl: finalAudioUrl}));
        alert("🎉 工程保存并发布成功！\n云端音频已就绪，C 端用户可直接流畅播放。");
      } else {
        alert("保存失败: " + data.error);
      }
    } catch (e) {
      alert("保存遇到网络错误: " + e.message);
    }
  };

  // === 2. 删除项目引擎 ===
  const handleDeleteProject = async (id, title, e) => {
    if (e) e.stopPropagation();
    if (!window.confirm(`⚠️ 危险操作：\n您确定要永久删除项目【${title}】吗？\n此操作不可逆，云端数据将被彻底清空！`)) return;
    
    try {
      const res = await fetch('/api/project/delete', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id })
      });
      const data = await res.json();
      if (data.success) {
        setProjectList(prev => prev.filter(p => p.id !== id));
      } else {
        alert("删除失败: " + data.error);
      }
    } catch (e) {
      alert("删除时遇到网络错误！");
    }
  };

  const handleExtractCandidates = async () => {
    if (sentences.length === 0) return alert("请先解析或加载剧本内容！");
    setShowVocabLab(true); setVocabPhase('select'); setIsVocabLoading(true); setCandidateWords([]); setSelectedWords([]);
    
    const fullText = sentences.map(s => s.en).join(" ");
    const prompt = `You are an expert English teacher. Scan the following news text and extract exactly 20 important vocabulary words suitable for middle/high school ESL learners (K12). Return ONLY a JSON object with a single key "candidates" containing an array of strings. TEXT: ${fullText.substring(0, 3000)}`;

    try {
      const res = await fetch('/api/translate', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ messages: [{ role: 'user', content: prompt }], temperature: 0.2, response_format: { type: "json_object" } })
      });
      const data = await res.json();
      const content = JSON.parse(data.choices[0].message.content);
      setCandidateWords(content.candidates || []);
    } catch (e) {
      alert("词汇提取失败，请重试！");
    } finally { setIsVocabLoading(false); }
  };

  const handleGenerateVocabCards = async () => {
    if (selectedWords.length === 0) return alert("请至少选择一个单词！");
    setVocabPhase('cards'); setIsVocabLoading(true);
    
    const prompt = `You are a professional ESL teacher. Generate detailed learning cards for the following words: ${selectedWords.join(", ")}. Return ONLY a JSON object with a key "cards" containing an array of objects. Each object MUST have: "word", "phonetic", "zh", "en", "phrases" (array of 2-3 phrases with Chinese), "example". Strictly use Simplified Chinese.`;

    try {
      const res = await fetch('/api/translate', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ messages: [{ role: 'user', content: prompt }], temperature: 0.2, response_format: { type: "json_object" } })
      });
      const data = await res.json();
      const content = JSON.parse(data.choices[0].message.content);
      setVocabCards(content.cards || []);
    } catch (e) {
      alert("卡片生成失败，请重试！"); setVocabPhase('select');
    } finally { setIsVocabLoading(false); }
  };

  const toggleWordSelection = (word) => setSelectedWords(prev => prev.includes(word) ? prev.filter(w => w !== word) : [...prev, word]);

  const startProcessing = async () => {
    if (!formData.audioUrl) return alert("请上传音频文件！");
    
    setIsProcessing(true);
    setSentences([]);
    setBlocks([]);
    setIsPlaying(false);
    if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current.currentTime = 0;
    }
    
    try {
      setProcessMsg("0. 正在将大尺寸音频直传至 Vercel Blob 云端暂存区...");
      // 💡 修复解析遇阻: 增加 addRandomSuffix
      const blobResult = await upload(formData.audioFile.name, formData.audioFile, {
        access: 'public',
        handleUploadUrl: '/api/upload',
      });
      const cloudAudioUrl = blobResult.url;

      setProcessMsg("1. 正在唤醒大模型进行高精度识别与对齐...");
      const whisperRes = await fetch('/api/transcribe', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ fileUrl: cloudAudioUrl }) 
      }).catch(err => {
          throw new Error("网络断开或后端接口无法连接。");
      });

      if (!whisperRes.ok) {
          if (whisperRes.status === 503) {
              throw new Error("503 Service Unavailable: 解析服务器目前崩溃宕机或过载，请稍后再试或更换节点。");
          }
          let errText = whisperRes.statusText;
          try { const errJson = await whisperRes.json(); errText = errJson.error?.message || errJson.error || errText; } catch(e) {}
          throw new Error(`Whisper 识别失败 (${whisperRes.status}): ${errText}`);
      }
      
      const whisperResult = await whisperRes.json();
      let allWords = [];
      if (whisperResult.words && whisperResult.words.length > 0) {
          allWords = whisperResult.words;
      } else if (whisperResult.segments) {
          whisperResult.segments.forEach(seg => {
              const words = seg.text.trim().split(/\s+/);
              const totalChars = words.reduce((acc, w) => acc + w.length, 0);
              const duration = seg.end - seg.start;
              let t = seg.start;
              words.forEach(w => {
                  const wDur = totalChars > 0 ? (w.length / totalChars) * duration : 0;
                  allWords.push({ word: w, start: t, end: t + wDur });
                  t += wDur;
              });
          });
      } else {
          throw new Error("接口未返回时间轴数据。");
      }
      
      setProcessMsg("2. 正在进行基础时间轴切分 (等待您后续手工切割新闻段落)...");
      const parsedSentences = buildSubtitleStructures(allWords);

      const initialBlocks = [{
          id: 'block-0',
          title: `新闻首段 (请在下方手工向下切割新段落)`,
          image: ""
      }];

      let extractedDateStr = "";
      const chunkSize = 8; 
      const totalChunks = Math.ceil(parsedSentences.length / chunkSize);

      for (let i = 0; i < parsedSentences.length; i += chunkSize) {
        setProcessMsg(`3. Llama 模型双语同步中 (第 ${Math.floor(i/chunkSize)+1}/${totalChunks} 批)...`);
        const chunk = parsedSentences.slice(i, i + chunkSize);
        const isFirstChunk = i === 0;
        
        const translationPrompt = `You are a professional subtitle translator.
        1. Contextualize using the RAW REFERENCE provided.
        ${isEnSourceRaw ? '2. CRITICAL: For the "en" field in JSON, you MUST replace the OCR English text with the EXACT matching phrases from the RAW REFERENCE. Fix any typos.' : '2. Translate the full English sentences to natural Chinese.'}
        3. Translate the full English sentences to natural Chinese. STRCITLY USE SIMPLIFIED CHINESE (简体中文).
        ${isFirstChunk ? '4. Extract broadcast date if mentioned (e.g. "Wednesday, Oct 11th") to Chinese format (e.g. "10月11日 星期三"). Else return "".' : '4. extractedDate MUST be "".'}
        5. You MUST translate EVERY SINGLE sentence provided. Return EXACTLY ${chunk.length} items mapping exactly to the input "id".

        RAW REFERENCE: ${formData.rawText ? formData.rawText.substring(0, 1000) : "None."}
        INPUT JSON: ${JSON.stringify(chunk.map(c => ({ id: c.id, en: c.en })))}

        OUTPUT MUST BE VALID JSON FORMAT:
        {
          "extractedDate": "...",
          "subtitles": [ { "id": <exact_id>, "en": "...", "zh": "..." } ]
        }`;

        let chunkSuccess = false;
        let retryCount = 0;
        const maxRetries = 3;

        while (!chunkSuccess && retryCount < maxRetries) {
          try {
            const llmRes = await fetch('/api/translate', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                messages: [{ role: 'user', content: translationPrompt }],
                temperature: 0.1,
                response_format: { type: "json_object" } 
              })
            });

            if (!llmRes.ok) {
                let errMsg = llmRes.statusText || "未知报错";
                try {
                    const errRaw = await llmRes.text();
                    const errJson = JSON.parse(errRaw);
                    errMsg = errJson.error?.message || errJson.error || errJson.message || errRaw;
                } catch (e) {}
                if (llmRes.status === 429) throw new Error("429");
                throw new Error(`${llmRes.status} ${errMsg}`);
            }
            
            const llmResult = await llmRes.json();
            let content = llmResult.choices[0].message.content;
            
            const jsonMatch = content.match(/\{[\s\S]*\}/);
            if (!jsonMatch) throw new Error(`大模型未返回有效的 JSON 结构。原始片段: ${content.substring(0,50)}`);
            
            let parsed;
            try {
                parsed = JSON.parse(jsonMatch[0]);
            } catch (parseErr) {
                console.error("导致崩溃的原始 LLM 返回内容:", content);
                throw new Error(`JSON Parse error: ${parseErr.message}`);
            }

            const transDict = {};
            (parsed.subtitles || []).forEach(t => transDict[t.id] = { zh: t.zh, en: t.en });
            
            chunk.forEach(sent => {
                const result = transDict[sent.id] || {};
                sent.zh = result.zh || "（防漏译：大模型未生成此句中文，请手动补全）";
                if (isEnSourceRaw && result.en) {
                    sent.en = result.en;
                    if (sent.chunks && sent.chunks.length > 0) {
                        sent.chunks[0].en = result.en;
                        for (let k = 1; k < sent.chunks.length; k++) sent.chunks[k].en = "";
                    }
                }
            });

            if (isFirstChunk && parsed.extractedDate) extractedDateStr = parsed.extractedDate;
            chunkSuccess = true;

          } catch (e) {
            console.error("翻译异常:", e);
            let displayError = e.message;
            if (e.name === "TypeError" && e.message.includes("fetch")) {
                displayError = "后端代理连接失败";
            }

            if (e.message === "429") {
                retryCount++;
                setProcessMsg(`触发额度超限保护，系统智能休眠 ${retryCount * 10} 秒后自动续传...`);
                await delay(10000 * retryCount);
                continue;
            }

            if (retryCount >= maxRetries - 1) {
                chunk.forEach(sent => { sent.zh = `【异常报错】${displayError}`; });
                break;
            }
            retryCount++;
            setProcessMsg(`节点通道受阻 [${displayError}]，尝试重新唤醒 (${retryCount}/${maxRetries})...`);
            await delay(3000);
          }
        }
        if (i + chunkSize < parsedSentences.length) {
            await delay(4000); 
        }
      }

      setNewsDate(extractedDateStr || getFormattedDate());
      setProcessMsg("4. 装载双轨媒体池与防跳动网格...");
      
      setBlocks(initialBlocks);

      setTimeout(() => {
        setSentences(parsedSentences);
        setCurrentTime(0);
        setIsProcessing(false);
        setStudioView('workspace');
      }, 500);

    } catch (error) {
      console.error("处理失败:", error);
      alert(`工作台解析遇阻！\n\n【诊断报告】:\n${error.message}`);
      setIsProcessing(false);
    }
  };

  const handleMergeSentenceUp = (sentIdx) => {
    setSentences(prev => {
        if (sentIdx <= 0) return prev;
        const newSentences = [...prev];
        const prevSent = newSentences[sentIdx - 1];
        const curSent = newSentences[sentIdx];

        if (prevSent.blockId !== curSent.blockId) return prev; 

        const mergedSent = {
            ...prevSent,
            en: prevSent.en + " " + curSent.en,
            zh: prevSent.zh + curSent.zh,
            chunks: [...prevSent.chunks, ...curSent.chunks]
        };

        newSentences.splice(sentIdx - 1, 2, mergedSent);
        return newSentences;
    });
  };

  const handleMergeChunkUp = (sentIdx, cIdx) => {
    setSentences(prev => {
        if (cIdx <= 0) return prev;
        const newSentences = [...prev];
        const sent = { ...newSentences[sentIdx] };
        const chunks = [...sent.chunks];

        const prevChunk = chunks[cIdx - 1];
        const targetChunk = chunks[cIdx];

        const mergedChunk = {
            ...prevChunk,
            en: prevChunk.en + " " + targetChunk.en,
            end: targetChunk.end
        };

        chunks.splice(cIdx - 1, 2, mergedChunk);
        sent.chunks = chunks;
        sent.en = sent.chunks.map(c => c.en).join(" "); 
        
        newSentences[sentIdx] = sent;
        return newSentences;
    });
  };

  const handleChunkKeyDown = (e, sentIdx, cIdx) => {
    if (e.key === 'Enter') {
        e.preventDefault();
        const cursorIdx = e.target.selectionStart;
        
        setSentences(prev => {
            const newSentences = [...prev];
            const sent = { ...newSentences[sentIdx] };
            const chunks = [...sent.chunks];
            const targetChunk = chunks[cIdx];
            
            if (cursorIdx === 0 || cursorIdx === targetChunk.en.length) return prev;
            
            const textA = targetChunk.en.substring(0, cursorIdx).trim();
            const textB = targetChunk.en.substring(cursorIdx).trim();
            if (!textA || !textB) return prev;
            
            const ratio = textA.length / (textA.length + textB.length);
            const duration = targetChunk.end - targetChunk.start;
            const midTime = targetChunk.start + duration * ratio;
            
            const chunkA = { ...targetChunk, id: targetChunk.id + '_a_' + Date.now(), en: textA, end: midTime };
            const chunkB = { ...targetChunk, id: targetChunk.id + '_b_' + Date.now(), en: textB, start: midTime };
            
            const sentStart = chunks[0].start;
            const sentEnd = chunks[chunks.length - 1].end;
            const sentDur = sentEnd - sentStart;
            const absoluteSplitRatio = sentDur > 0 ? (midTime - sentStart) / sentDur : 0.5;
            
            const zhLength = sent.zh.length;
            const absoluteZhSplitIdx = Math.floor(zhLength * absoluteSplitRatio);

            const zhA = sent.zh.substring(0, absoluteZhSplitIdx);
            const zhB = sent.zh.substring(absoluteZhSplitIdx);

            const sentA = {
                ...sent,
                id: sent.id + '_a_' + Date.now(),
                zh: zhA,
                chunks: [...chunks.slice(0, cIdx), chunkA],
            };
            sentA.en = sentA.chunks.map(c => c.en).join(" ");

            const sentB = {
                ...sent,
                id: sent.id + '_b_' + Date.now(),
                zh: zhB,
                chunks: [chunkB, ...chunks.slice(cIdx + 1)],
            };
            sentB.en = sentB.chunks.map(c => c.en).join(" ");

            newSentences.splice(sentIdx, 1, sentA, sentB);
            return newSentences;
        });
    } else if (e.key === 'Backspace') {
        if (e.target.selectionStart === 0 && e.target.selectionEnd === 0) {
            e.preventDefault();
            if (cIdx > 0) {
                handleMergeChunkUp(sentIdx, cIdx);
            } else if (sentIdx > 0) {
                handleMergeSentenceUp(sentIdx);
            }
        }
    }
  };

  const handleSplitAfter = (sentenceId, currentBlockId) => {
    const newBlockId = 'block-' + Date.now();
    setBlocks(prev => {
        const idx = prev.findIndex(b => b.id === currentBlockId);
        const newBlocks = [...prev];
        newBlocks.splice(idx + 1, 0, { id: newBlockId, title: `手工切割新段落`, image: "" });
        return newBlocks;
    });
    setSentences(prev => {
        let passed = false;
        return prev.map(sent => {
            if (sent.id === sentenceId) { passed = true; return sent; }
            if (passed && sent.blockId === currentBlockId) return { ...sent, blockId: newBlockId };
            return sent;
        });
    });
  };

  const handleMergeUp = (blockId) => {
    setBlocks(prev => {
        const idx = prev.findIndex(b => b.id === blockId);
        if (idx <= 0) return prev;
        const targetBlockId = prev[idx - 1].id;
        setSentences(subs => subs.map(sent => sent.blockId === blockId ? { ...sent, blockId: targetBlockId } : sent));
        const newBlocks = [...prev];
        newBlocks.splice(idx, 1);
        return newBlocks;
    });
  };

  const handleReplaceBlockImage = async (blockId, file) => {
    if (!file) return;
    const tempUrl = URL.createObjectURL(file);
    setBlocks(prev => prev.map(b => b.id === blockId ? { ...b, image: tempUrl } : b));
    try {
      // 💡 修复解析遇阻: 增加 addRandomSuffix
      const blobResult = await upload(`image_${Date.now()}_${file.name}`, file, { 
          access: 'public', 
          handleUploadUrl: '/api/upload',
      });
      setBlocks(prev => prev.map(b => b.id === blockId ? { ...b, image: blobResult.url } : b));
    } catch (error) { alert("配图上传云端失败"); }
  };

  const handleRenameBlock = (blockId, newTitle) => setBlocks(prev => prev.map(b => b.id === blockId ? { ...b, title: newTitle } : b));

  const togglePlay = (e) => {
      if (e && e.stopPropagation) e.stopPropagation();
      const audio = audioRef.current;
      if (!formData.audioUrl) return alert("请先上传音频！");
      if (!audio || isExportingVideo) return;
      if (!audio.paused) { audio.pause(); setIsPlaying(false); } 
      else {
          if (audio.currentTime >= (formData.audioDuration || audio.duration) - 0.1 || audio.ended) { audio.currentTime = 0; setCurrentTime(0); }
          audio.play().then(() => setIsPlaying(true)).catch(err => { alert("自动播放被阻拦，请点击页面后再试。"); setIsPlaying(false); });
      }
  };

  const handleTimeUpdate = () => { if (audioRef.current && !isExportingVideo) setCurrentTime(audioRef.current.currentTime); };
  const handleSeek = (e) => { const newTime = parseFloat(e.target.value); setCurrentTime(newTime); if (audioRef.current) audioRef.current.currentTime = newTime; };
  const formatTime = (s) => `${Math.floor(s/60).toString().padStart(2,'0')}:${Math.floor(s%60).toString().padStart(2,'0')}.${Math.floor((s%1)*10)}`;
  
  const handleExportSRT = () => {
    let srt = "";
    let srtIdx = 1;
    sentences.forEach(sent => {
        if (!sent.chunks || sent.chunks.length === 0) return;
        const start = sent.chunks[0].start;
        const end = sent.chunks[sent.chunks.length - 1].end;
        const pad = (n, s) => ('000'+n).slice(s*-1);
        const fmt = (sec) => `${pad(Math.floor(sec/3600),2)}:${pad(Math.floor((sec%3600)/60),2)}:${pad(Math.floor(sec%60),2)},${pad(Math.floor((sec%1)*1000),3)}`;
        srt += `${srtIdx++}\n${fmt(start)} --> ${fmt(end)}\n${sent.en}\n${sent.zh}\n\n`;
    });
    const blob = new Blob([srt], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a'); a.href = url; a.download = `${formData.title}.srt`;
    document.body.appendChild(a); a.click(); document.body.removeChild(a);
  };

  const wrapTextCanvas = (ctx, text, x, y, maxWidth, lineHeight) => {
      if (!text) return y;
      let line = '';
      let currentY = y;
      const tokens = text.match(/[\u4e00-\u9fa5]|[\w\.\,\!\?\-\']+|\s+/g) || text.split('');
      for (let n = 0; n < tokens.length; n++) {
          const token = tokens[n];
          const testLine = line + token;
          if (ctx.measureText(testLine).width > maxWidth && n > 0 && token.trim() !== '') {
              ctx.fillText(line, x, currentY);
              line = token;
              currentY += lineHeight;
          } else {
              line = testLine;
          }
      }
      ctx.fillText(line, x, currentY);
      return currentY + lineHeight;
  };

  const drawRoundRect = (ctx, x, y, w, h, r) => {
      if (ctx.roundRect) { ctx.beginPath(); ctx.roundRect(x, y, w, h, r); ctx.closePath(); } else {
          ctx.beginPath(); ctx.moveTo(x+r, y); ctx.lineTo(x+w-r, y); ctx.quadraticCurveTo(x+w, y, x+w, y+r);
          ctx.lineTo(x+w, y+h-r); ctx.quadraticCurveTo(x+w, y+h, x+w-r, y+h); ctx.lineTo(x+r, y+h);
          ctx.quadraticCurveTo(x, y+h, x, y+h-r); ctx.lineTo(x, y+r); ctx.quadraticCurveTo(x, y, x+r, y); ctx.closePath();
      }
  };

  const startVideoExport = async () => {
      if (!formData.audioUrl || sentences.length === 0) return alert("请先完成剧本构建。");
      setIsPlaying(false);
      setIsExportingVideo(true);
      setExportProgress(0);

      const canvas = exportCanvasRef.current;
      const ctx = canvas.getContext('2d');
      ctx.fillStyle = '#000000'; ctx.fillRect(0, 0, 1080, 1920);

      let recordedChunks = [];
      let animationId;
      let mediaRecorder;

      try {
          if (!canvas.captureStream) throw new Error("当前 Safari 版本不支持流捕获，建议使用 Chrome 导出视频。");
          const canvasStream = canvas.captureStream(30);
          
          const audio = new Audio(formData.audioUrl);
          audio.crossOrigin = "anonymous";
          const audioCtx = new (window.AudioContext || window.webkitAudioContext)();
          const dest = audioCtx.createMediaStreamDestination();
          const source = audioCtx.createMediaElementSource(audio);
          
          source.connect(dest);
          source.connect(audioCtx.destination); 
          
          const combinedStream = new MediaStream([...canvasStream.getVideoTracks(), ...dest.stream.getAudioTracks()]);
          const supportedMimeTypes = ['video/mp4', 'video/webm;codecs=vp9', 'video/webm', ''];
          let options = {};
          for (let type of supportedMimeTypes) {
              if (type === '' || MediaRecorder.isTypeSupported(type)) {
                  if (type !== '') options.mimeType = type; break;
              }
          }

          mediaRecorder = new MediaRecorder(combinedStream, options);
          mediaRecorder.ondataavailable = (e) => { if (e.data && e.data.size > 0) recordedChunks.push(e.data); };
          mediaRecorder.onstop = () => {
              const ext = (options.mimeType || '').includes('webm') ? 'webm' : 'mp4';
              const blob = new Blob(recordedChunks, { type: options.mimeType || 'video/mp4' });
              const a = document.createElement('a'); a.href = URL.createObjectURL(blob);
              a.download = `KizEnglish_Export.${ext}`; a.click();
              setIsExportingVideo(false); cancelAnimationFrame(animationId); audioCtx.close();
          };

          const drawFrame = () => {
              const time = audio.currentTime;
              setExportProgress(time / (formData.audioDuration || audio.duration));

              ctx.fillStyle = '#000000'; ctx.fillRect(0, 0, 1080, 1920);
              
              ctx.fillStyle = '#ffffff'; ctx.font = 'bold 120px sans-serif'; ctx.textAlign = 'center'; ctx.fillText('KizEnglish', 540, 150);
              ctx.fillStyle = '#facc15'; ctx.font = '500 45px sans-serif'; ctx.fillText(newsDate || getFormattedDate(), 540, 220);

              let activeSentence = null;
              let activeChunk = null;
              for (let i = 0; i < sentences.length; i++) {
                  const sent = sentences[i];
                  if (sent.chunks.length === 0) continue;
                  if (time >= sent.chunks[0].start && time <= sent.chunks[sent.chunks.length - 1].end) {
                      activeSentence = sent;
                      activeChunk = sent.chunks.find(c => time >= c.start && time <= c.end);
                      break;
                  }
              }

              let targetImage = "";
              const referenceSentence = activeSentence || sentences.slice().reverse().find(s => s.chunks[0]?.start <= time) || sentences[0];
              if (referenceSentence) {
                  const blockIdx = blocks.findIndex(b => b.id === referenceSentence.blockId);
                  for (let i = blockIdx; i >= 0; i--) {
                      if (blocks[i] && blocks[i].image) { targetImage = blocks[i].image; break; }
                  }
              }

              const imgY = 260; const imgH = 1080 * (9/16); 
              if (targetImage && imageElementCache.current[targetImage]) {
                  ctx.drawImage(imageElementCache.current[targetImage], 0, imgY, 1080, imgH);
              } else {
                  ctx.fillStyle = '#111827'; ctx.fillRect(0, imgY, 1080, imgH);
              }

              if (activeSentence) {
                  const displayEn = activeChunk ? activeChunk.en : activeSentence.chunks[activeSentence.chunks.length - 1].en;
                  const boxWidth = 960; const boxX = 60; const textX = 100; const textMaxWidth = 880;
                  const enBoxY = imgY + imgH + 60;
                  ctx.font = '600 48px sans-serif';
                  
                  let maxEnBoxHeight = 0;
                  activeSentence.chunks.forEach(c => {
                      let simY = enBoxY + 70;
                      const tokens = c.en.match(/[\w\.\,\!\?\-\']+|\s+/g) || c.en.split('');
                      let simLine = '';
                      for (let n = 0; n < tokens.length; n++) {
                          const testLine = simLine + tokens[n];
                          if (ctx.measureText(testLine).width > textMaxWidth && n > 0 && tokens[n].trim() !== '') {
                              simLine = tokens[n]; simY += 65;
                          } else { simLine = testLine; }
                      }
                      if ((simY - enBoxY) + 50 > maxEnBoxHeight) maxEnBoxHeight = (simY - enBoxY) + 50;
                  });

                  ctx.fillStyle = 'rgba(30, 58, 138, 0.6)'; ctx.strokeStyle = 'rgba(59, 130, 246, 0.3)'; ctx.lineWidth = 3;
                  drawRoundRect(ctx, boxX, enBoxY, boxWidth, maxEnBoxHeight, 24); ctx.fill(); ctx.stroke();
                  ctx.fillStyle = '#ffffff'; ctx.textAlign = 'left';
                  wrapTextCanvas(ctx, displayEn, textX, enBoxY + 70, textMaxWidth, 65);

                  const zhBoxY = enBoxY + maxEnBoxHeight + 40;
                  ctx.font = 'bold 42px sans-serif';
                  let maxZhBoxHeight = 0;
                  const zhChunksList = splitChineseText(activeSentence.zh);
                  zhChunksList.forEach(chunk => {
                      let zhSimY = zhBoxY + 65;
                      const zhTokens = chunk.split('');
                      let zhSimLine = '';
                      for (let n = 0; n < zhTokens.length; n++) {
                          const testLine = zhSimLine + zhTokens[n];
                          if (ctx.measureText(testLine).width > textMaxWidth && n > 0) {
                              zhSimLine = zhTokens[n]; zhSimY += 60;
                          } else { zhSimLine = testLine; }
                      }
                      if ((zhSimY - zhBoxY) + 45 > maxZhBoxHeight) maxZhBoxHeight = (zhSimY - zhBoxY) + 45;
                  });

                  let activeZh = activeSentence.zh;
                  if (zhChunksList.length > 0) {
                      const totalDur = activeSentence.chunks[activeSentence.chunks.length-1].end - activeSentence.chunks[0].start;
                      let elapsed = time - activeSentence.chunks[0].start;
                      const idx = Math.min(Math.floor((elapsed / totalDur) * zhChunksList.length), zhChunksList.length - 1);
                      activeZh = zhChunksList[Math.max(0, idx)];
                  }

                  ctx.fillStyle = '#4285F4'; ctx.strokeStyle = '#4285F4';
                  drawRoundRect(ctx, boxX, zhBoxY, boxWidth, maxZhBoxHeight, 24); ctx.fill(); ctx.stroke();
                  ctx.fillStyle = '#ffffff';
                  wrapTextCanvas(ctx, activeZh, textX, zhBoxY + 65, textMaxWidth, 60);
              }

              animationId = requestAnimationFrame(drawFrame);
          };

          mediaRecorder.start();
          audio.play().catch(() => alert("由于安全机制，音频导出需要您在此页面任意点击后再试。"));
          drawFrame();

          audio.onended = () => {
              mediaRecorder.stop();
          };

      } catch (e) {
          console.error(e);
          alert(`视频导出初始化失败: ${e.message}`);
          setIsExportingVideo(false); cancelAnimationFrame(animationId);
      }
  };

  // ==========================================
  // ======== C 端页面组件 ========
  // ==========================================
  const renderPortalHome = () => (
    <div className="min-h-screen bg-slate-50 font-sans text-gray-800">
      <header className="bg-white border-b border-gray-200 px-8 py-4 flex justify-between items-center sticky top-0 z-30 shadow-sm">
        <div className="flex items-center">
            <div className="bg-purple-600 text-white p-2 rounded-xl mr-3 shadow-md"><Globe size={24} /></div>
            <div>
                <h1 className="text-xl font-black text-gray-800 tracking-tight">KidNuz <span className="text-purple-600 font-light">Daily</span></h1>
                <p className="text-[10px] text-gray-500 font-medium uppercase tracking-widest">Global News for K12</p>
            </div>
        </div>
        <button onClick={() => { setAppMode('studio'); fetchProjects(); }} className="text-xs text-gray-500 hover:text-purple-600 font-bold transition-colors flex items-center bg-gray-100 hover:bg-purple-50 px-3 py-1.5 rounded-lg">
            进入创作者后台 <ChevronLeft size={14} className="ml-1 rotate-180" />
        </button>
      </header>

      <main className="max-w-6xl mx-auto p-8">
        <div className="mb-8">
            <h2 className="text-3xl font-bold text-gray-800 mb-2">最新听力新闻</h2>
            <p className="text-gray-500 font-medium">每日更新，磨出英文原语感</p>
        </div>

        {isLoadingList ? (
            <div className="py-20 flex flex-col items-center"><Loader2 className="animate-spin text-purple-500 mb-4" size={40}/></div>
        ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
                {projectList.map(p => {
                    let coverImage = "";
                    try { 
                        let parsedBlocks = [];
                        if (p.blocks) parsedBlocks = typeof p.blocks === 'string' ? JSON.parse(p.blocks) : p.blocks;
                        if (Array.isArray(parsedBlocks)) {
                            const firstImageBlock = parsedBlocks.find(b => b && b.image);
                            if (firstImageBlock) coverImage = firstImageBlock.image;
                        }
                    } catch(e) {}
                    
                    return (
                        <div key={p.id} onClick={() => loadProject(p.id)} className="bg-white rounded-2xl overflow-hidden shadow-sm hover:shadow-xl transition-all duration-300 cursor-pointer group border border-gray-100 flex flex-col">
                            <div className="aspect-video bg-gray-900 relative overflow-hidden">
                                {coverImage ? <img src={coverImage} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" /> : <div className="w-full h-full flex items-center justify-center"><MonitorPlay size={32} className="text-gray-600" /></div>}
                                <div className="absolute inset-0 bg-black/20 group-hover:bg-transparent transition-colors"></div>
                                <div className="absolute bottom-3 right-3 bg-black/60 backdrop-blur-md text-white text-[10px] font-bold px-2 py-1 rounded flex items-center"><Play size={10} fill="currentColor" className="mr-1"/> 播放</div>
                            </div>
                            <div className="p-5 flex-1 flex flex-col">
                                <p className="text-xs font-bold text-purple-600 mb-2">{p.newsDate || new Date(p.updatedAt).toLocaleDateString()}</p>
                                <h3 className="font-bold text-gray-800 text-lg leading-tight mb-3 group-hover:text-purple-600 transition-colors line-clamp-2">{p.title || '今日国际新闻'}</h3>
                            </div>
                        </div>
                    )
                })}
            </div>
        )}
      </main>
    </div>
  );

  const renderPortalDetail = () => (
    <div className="flex h-screen w-screen bg-white font-sans text-gray-800 overflow-hidden">
        {/* 左侧：手机播放器区 */}
        <div className="w-[450px] h-full p-8 flex flex-col items-center justify-center shrink-0 border-r border-gray-100 bg-slate-900 relative">
            <button onClick={() => { setPortalView('home'); setIsPlaying(false); audioRef.current?.pause(); }} className="absolute top-6 left-6 text-white/60 hover:text-white text-sm font-bold flex items-center transition-colors z-50 bg-black/20 px-3 py-1.5 rounded-full backdrop-blur-md">
                <ChevronLeft size={16} className="mr-1" /> 返回主页
            </button>
            <div className="w-[375px] h-[812px] bg-black rounded-[3rem] border-[14px] border-gray-800 shadow-[0_0_50px_rgba(0,0,0,0.5)] relative overflow-hidden flex flex-col ring-1 ring-white/10">
                <div className="absolute top-0 inset-x-0 h-6 bg-gray-800 rounded-b-2xl w-1/2 mx-auto z-50"></div>
                {renderPhoneScreen()}
            </div>
        </div>

        {/* 右侧：沉浸式阅读与学习区 */}
        <div className="flex-1 h-full bg-slate-50 flex flex-col relative">
            <header className="bg-white border-b border-gray-200 px-8 py-5 flex justify-between items-center shrink-0 z-10 shadow-sm">
                <div>
                    <h2 className="text-2xl font-black text-gray-800 tracking-tight">{formData.title}</h2>
                    <p className="text-sm text-gray-500 font-medium mt-1">{newsDate}</p>
                </div>
                <div className="flex space-x-3">
                    <div className="flex bg-gray-100 p-1 rounded-xl">
                        <button onClick={() => setReadingLang('en')} className={`px-4 py-1.5 rounded-lg text-xs font-bold transition-colors ${readingLang === 'en' ? 'bg-white shadow-sm text-gray-800' : 'text-gray-500'}`}>English</button>
                        <button onClick={() => setReadingLang('zh')} className={`px-4 py-1.5 rounded-lg text-xs font-bold transition-colors ${readingLang === 'zh' ? 'bg-white shadow-sm text-gray-800' : 'text-gray-500'}`}>中文</button>
                        <button onClick={() => setReadingLang('bilingual')} className={`px-4 py-1.5 rounded-lg text-xs font-bold transition-colors ${readingLang === 'bilingual' ? 'bg-white shadow-sm text-gray-800' : 'text-gray-500'}`}>双语</button>
                    </div>
                    <button onClick={handleExtractCandidates} className="bg-purple-600 hover:bg-purple-700 text-white px-4 py-2 rounded-xl text-sm font-bold flex items-center shadow-sm">
                        <Sparkles size={16} className="mr-2" /> AI 词汇提取
                    </button>
                </div>
            </header>

            {/* 👇 这里就是彻底重构后的排版区域 👇 */}
            <div className="flex-1 overflow-y-auto p-6 lg:p-8">
                <div className="max-w-4xl mx-auto space-y-4">
                    {/* 按您后台设定的段落 (blocks) 进行循环，而不是按句子循环 */}
                    {blocks.map(block => {
                        const blockSentences = sentences.filter(s => s.blockId === block.id);
                        if (blockSentences.length === 0) return null;
                        
                        // 提取该段落首个时间戳，用于点击跳转
                        const firstChunk = blockSentences[0]?.chunks[0];
                        // 判断当前播放时间是否属于这个大段落
                        const isBlockActive = blockSentences.some(sent => 
                            sent.chunks.some(c => currentTime >= c.start && currentTime <= c.end)
                        );

                        return (
                            <div 
                                key={block.id} 
                                className={`transition-all duration-300 p-4 rounded-xl cursor-pointer ${isBlockActive ? 'bg-white shadow-sm ring-1 ring-purple-300' : 'hover:bg-gray-50'}`} 
                                onClick={() => { if(audioRef.current && firstChunk) { audioRef.current.currentTime = firstChunk.start; setIsPlaying(true); audioRef.current?.play(); }}}
                            >
                                {/* 英文原文：紧凑排版，保留高亮 */}
                                {readingLang !== 'zh' && (
                                    <p className={`text-[15px] font-medium leading-relaxed ${readingLang === 'bilingual' ? 'mb-1.5' : ''} ${isBlockActive ? 'text-gray-900' : 'text-gray-700'}`}>
                                        {blockSentences.map(sent => {
                                            return sent.chunks.map(c => {
                                                const isChunkActive = currentTime >= c.start && currentTime <= c.end;
                                                return <span key={c.id} className={`transition-colors ${isChunkActive ? 'text-purple-600 bg-purple-100/50 rounded px-0.5' : ''}`}>{c.en} </span>
                                            });
                                        })}
                                    </p>
                                )}
                                {/* 中文翻译：小字号沉浸式辅助 */}
                                {readingLang !== 'en' && (
                                    <p className={`text-[13px] leading-relaxed ${isBlockActive ? 'text-gray-700 font-medium' : 'text-gray-500'}`}>
                                        {blockSentences.map(sent => sent.zh).join(' ')}
                                    </p>
                                )}
                            </div>
                        )
                    })}
                </div>
                <div className="h-20"></div>
            </div>
        </div>
    </div>
  );

  const renderPhoneScreen = () => {
    if (isProcessing) return <div className="flex-1 flex flex-col items-center justify-center bg-black text-white p-6"><Loader2 size={40} className="animate-spin text-blue-500 mb-4" /><p className="text-sm">{processMsg}</p></div>;
    if (sentences.length === 0) return <div className="flex-1 flex flex-col items-center justify-center bg-black text-gray-500 p-6 text-center"><ImageIcon size={48} className="opacity-50 mb-4" /><p className="text-sm">尚未加载新闻剧本</p></div>;

    let activeSentence = null; let activeChunk = null;
    for (let i = 0; i < sentences.length; i++) {
        const sent = sentences[i];
        if (sent.chunks.length === 0) continue;
        if (currentTime >= sent.chunks[0].start && currentTime <= sent.chunks[sent.chunks.length - 1].end) {
            activeSentence = sent; activeChunk = sent.chunks.find(c => currentTime >= c.start && currentTime <= c.end); break;
        }
    }

    let targetImage = ""; 
    const referenceSentence = activeSentence || sentences.slice().reverse().find(s => s.chunks[0]?.start <= currentTime) || sentences[0];
    if (referenceSentence) {
        const blockIdx = blocks.findIndex(b => b.id === referenceSentence.blockId);
        for (let i = blockIdx; i >= 0; i--) { if (blocks[i] && blocks[i].image) { targetImage = blocks[i].image; break; } }
    }

    let longestChunkEn = activeSentence ? activeSentence.chunks.reduce((p, c) => c.en.length > p.en.length ? c : p, { en: "" }).en : "";
    const zhChunksTextList = activeSentence ? splitChineseText(activeSentence.zh) : [];
    let activeZh = activeSentence ? activeSentence.zh : "";
    
    if (activeSentence && zhChunksTextList.length > 0) {
        const totalDur = activeSentence.chunks[activeSentence.chunks.length-1].end - activeSentence.chunks[0].start;
        let elapsed = currentTime - activeSentence.chunks[0].start;
        const idx = Math.min(Math.floor((elapsed / totalDur) * zhChunksTextList.length), zhChunksTextList.length - 1);
        activeZh = zhChunksTextList[Math.max(0, idx)];
    }

    return (
      <div className="relative flex flex-col h-full w-full bg-black overflow-hidden cursor-pointer" onClick={togglePlay}>
        <div className="flex-none pt-12 pb-2 flex flex-col items-center justify-center text-white px-6 text-center z-10 shrink-0">
          <h1 className="text-[28px] font-extrabold tracking-tight mb-0.5 font-sans leading-none">KidNuz</h1>
          <p className="text-[11px] font-medium opacity-95 text-yellow-400 leading-none">{newsDate}</p>
        </div>
        <div className="w-full shrink-0 relative" style={{ aspectRatio: '16/9' }}>
           {targetImage ? <CrossfadeImage src={targetImage} /> : <div className="w-full h-full bg-gray-900 flex items-center justify-center"><ImageIcon size={32} className="text-gray-600 opacity-50" /></div>}
           {!isPlaying && <div className="absolute inset-0 z-40 flex items-center justify-center pointer-events-none"><div className="bg-black/50 rounded-full p-4 backdrop-blur-md shadow-xl"><Play size={32} fill="currentColor" className="text-white ml-1" /></div></div>}
        </div>
        
        <div className="flex-1 w-full px-4 pt-4 overflow-hidden flex flex-col justify-start">
            {activeSentence && (
              <>
                <div className="w-full bg-blue-900/60 backdrop-blur-md rounded-xl border border-blue-500/30 grid">
                  <div className="col-start-1 row-start-1 p-3.5 opacity-0 pointer-events-none select-none"><p className="font-semibold text-[17px] leading-[1.4] text-left">{longestChunkEn}</p></div>
                  {activeSentence.chunks.map((chunk) => {
                    const displayEn = activeChunk ? activeChunk.en : activeSentence.chunks[activeSentence.chunks.length - 1].en;
                    return (
                      <div key={chunk.id} className={`col-start-1 row-start-1 p-3.5 transition-opacity duration-200 ${displayEn === chunk.en ? 'opacity-100 z-10' : 'opacity-0 pointer-events-none'}`}>
                        <p className="text-white font-semibold text-[17px] leading-[1.4] text-left">{chunk.en}</p>
                      </div>
                    )
                  })}
                </div>
                <div className="w-full bg-purple-600 backdrop-blur-md rounded-xl shadow-lg grid mt-3">
                  {zhChunksTextList.length > 0 ? zhChunksTextList.map((zhChunk, zIdx) => (
                    <div key={zIdx} className={`col-start-1 row-start-1 p-3.5 transition-opacity duration-200 ${activeZh === zhChunk ? 'opacity-100 z-10' : 'opacity-0 pointer-events-none'}`}>
                      <p className="text-white font-bold text-[15px] leading-relaxed text-left drop-shadow-sm">{zhChunk}</p>
                    </div>
                  )) : (
                    <div className="col-start-1 row-start-1 p-3.5 opacity-100 z-10"><p className="text-white font-bold text-[15px] leading-relaxed text-left drop-shadow-sm">{activeSentence.zh}</p></div>
                  )}
                </div>
              </>
            )}
        </div>

        <div className="absolute bottom-0 left-0 right-0 h-1.5 bg-gray-800 z-50 group" onClick={e => e.stopPropagation()}>
          <div className="h-full bg-yellow-400 ease-linear pointer-events-none" style={{ width: `${(currentTime / (formData.audioDuration || 1)) * 100}%` }}></div>
          <input type="range" min="0" max={formData.audioDuration || 1} step="0.01" value={currentTime} onChange={handleSeek} className="absolute inset-0 w-full h-4 -top-1 opacity-0 cursor-pointer z-10" />
        </div>
      </div>
    );
  };
  // ==========================================
  // ======== B 端工作台：主控台 (Dashboard) ========
  // ==========================================
  const renderStudioDashboard = () => {
    // 过滤检索项目
    const filteredProjects = projectList.filter(p => 
        (p.title || '').toLowerCase().includes(searchQuery.toLowerCase()) || 
        (p.newsDate || '').includes(searchQuery)
    );

    return (
      <div className="min-h-screen bg-slate-50 font-sans text-gray-800">
        <header className="bg-white border-b border-gray-200 px-8 py-5 flex justify-between items-center sticky top-0 z-30 shadow-sm">
          <div className="flex items-center">
              <div className="bg-blue-600 text-white p-2.5 rounded-xl mr-3 shadow-md"><LayoutDashboard size={24} /></div>
              <div>
                  <h1 className="text-xl font-black text-gray-800 tracking-tight">KidNuz Creator Studio</h1>
                  <p className="text-[10px] text-gray-500 font-medium uppercase tracking-widest">全栈内容管理控制台</p>
              </div>
          </div>
          <button onClick={() => setAppMode('portal')} className="text-sm text-gray-500 hover:text-blue-600 font-bold transition-colors flex items-center bg-gray-100 hover:bg-blue-50 px-4 py-2 rounded-xl">
              退出后台，前往 C端前台 <ChevronLeft size={16} className="ml-1 rotate-180" />
          </button>
        </header>

        <main className="max-w-6xl mx-auto p-8">
          <div className="flex justify-between items-end mb-8">
              <div>
                  <h2 className="text-3xl font-bold text-gray-800 mb-2">项目概览</h2>
                  <p className="text-gray-500 font-medium">管理已有新闻或开启新的创作流程。</p>
              </div>
              <button 
                  onClick={() => {
                      // 重置所有表单状态，进入新建模式
                      setFormData({ id: null, title: '新建音频字幕项目', audioFile: null, audioName: '', audioUrl: '', audioDuration: 0, rawText: '' });
                      setSentences([]); setBlocks([]);
                      setStudioView('create');
                  }} 
                  className="bg-blue-600 hover:bg-blue-700 text-white px-5 py-2.5 rounded-xl text-sm font-bold flex items-center shadow-md transition-all"
              >
                  <Plus size={18} className="mr-2" /> 新建新闻项目
              </button>
          </div>

          <div className="bg-white p-2 rounded-xl border border-gray-200 shadow-sm flex items-center mb-6 w-full max-w-md">
             <Search size={18} className="text-gray-400 mx-3 shrink-0" />
             <input type="text" value={searchQuery} onChange={e => setSearchQuery(e.target.value)} placeholder="搜索项目标题或日期..." className="flex-1 bg-transparent border-none outline-none text-sm p-1" />
          </div>

          {isLoadingList ? (
              <div className="py-20 flex flex-col items-center"><Loader2 className="animate-spin text-blue-500 mb-4" size={40}/></div>
          ) : filteredProjects.length > 0 ? (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                  {filteredProjects.map(p => {
                      // 💡 智能封面提取：自动扫描所有块，找到第一张图片
                      console.log(`【X光透视】项目 ${p.title} 的所有数据:`, p);
                      let coverImage = "";
                      try { 
                          let parsedBlocks = [];
                          if (p.blocks) parsedBlocks = typeof p.blocks === 'string' ? JSON.parse(p.blocks) : p.blocks;
                          if (Array.isArray(parsedBlocks)) {
                              const firstImageBlock = parsedBlocks.find(b => b && b.image);
                              if (firstImageBlock) coverImage = firstImageBlock.image;
                          }
                      } catch(e) { console.log("此项目无封面或解析跳过"); }

                      return (
                          <div key={p.id} className="bg-white rounded-2xl overflow-hidden shadow-sm hover:shadow-lg transition-all duration-300 border border-gray-100 flex flex-col group">
                              {/* 封面区域：增加深色渐变背景和悬浮动效 */}
                              <div className="aspect-video bg-slate-900 relative overflow-hidden cursor-pointer" onClick={() => loadProject(p.id)}>
                                  {coverImage ? (
                                      <img 
                                          src={coverImage} 
                                          className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500 opacity-90 group-hover:opacity-100" 
                                      />
                                  ) : (
                                      <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-slate-800 to-slate-900">
                                          <ImageIcon size={32} className="text-slate-600" />
                                      </div>
                                  )}
                                  {/* 悬浮提示层 */}
                                  <div className="absolute inset-0 bg-blue-600/20 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                                      <div className="bg-white/90 p-3 rounded-full shadow-xl transform translate-y-4 group-hover:translate-y-0 transition-transform duration-300">
                                          <Edit3 size={24} className="text-blue-600" />
                                      </div>
                                  </div>
                              </div>

                              <div className="p-5 flex-1 flex flex-col">
                                  <div className="flex justify-between items-start mb-2">
                                      <p className="text-xs font-bold text-blue-600">{p.newsDate || (p.updatedAt ? new Date(p.updatedAt).toLocaleDateString() : '最近编辑')}</p>
                                      <button 
                                          onClick={(e) => handleDeleteProject(p.id, p.title, e)} 
                                          className="text-gray-400 hover:text-red-500 hover:bg-red-50 p-1.5 rounded-lg transition-colors" 
                                          title="永久删除"
                                      >
                                          <Trash2 size={16} />
                                      </button>
                                  </div>
                                  <h3 className="font-bold text-gray-800 text-lg leading-tight mb-3 cursor-pointer hover:text-blue-600 line-clamp-2" onClick={() => loadProject(p.id)}>
                                      {p.title || '未命名项目'}
                                  </h3>
                                  <div className="mt-auto text-[11px] text-gray-400 flex items-center font-mono bg-slate-50 p-2 rounded-lg">
                                      <FileAudio size={12} className="mr-1.5 text-slate-400"/> 
                                      <span className="truncate">原音频: {p.audioName || '无记录'}</span>
                                  </div>
                              </div>
                          </div>
                      )
                  })}

              </div>
          ) : (
              <div className="text-center py-20 text-gray-400 bg-white rounded-2xl border border-gray-100 border-dashed">
                  <FolderOpen size={48} className="mx-auto mb-3 text-gray-300" />
                  <p className="font-medium text-lg text-gray-500 mb-1">找不到相关项目</p>
                  <p className="text-sm">数据库中没有内容，或者未匹配到搜索词。</p>
              </div>
          )}
        </main>
      </div>
    );
  };
  // ==========================================
  // ======== B 端工作台：上传页 ========
  // ==========================================
  const renderStudioUpload = () => (
    <div className="flex h-screen w-screen bg-gray-50 font-sans text-gray-800 flex-col">
       <div className="p-8 max-w-3xl mx-auto w-full space-y-6 pt-16">
          <div className="border-b border-gray-200 pb-4 flex justify-between items-start">
            <div>
              <h1 className="text-2xl font-bold text-gray-800">构建新闻项目</h1>
              <p className="text-sm text-gray-500 mt-2">后台创作者中心 - 生成后可一键发布至前台。</p>
            </div>
            <div className="flex space-x-3">
              <button onClick={() => setAppMode('portal')} className="bg-purple-100 text-purple-700 hover:bg-purple-200 px-4 py-2 rounded-xl text-sm font-bold flex items-center transition-colors">
                 <Home size={16} className="mr-2" /> 返回前台体验区
              </button>
              <button 
                  onClick={() => { 
                    // 1. 停止物理音频播放
                    if (audioRef.current) {
                      audioRef.current.pause(); 
                    }
                    // 2. 将界面上的播放按钮重置为暂停图标状态
                    setIsPlaying(false); 
                    // 3. 执行原有的返回和刷新逻辑
                    setStudioView('dashboard'); 
                    fetchProjects(); 
                  }} 
                  className="bg-white border border-gray-200 hover:bg-gray-50 text-gray-700 px-4 py-2 rounded-xl text-sm font-bold flex items-center shadow-sm transition-colors"
                >
                 <LayoutDashboard size={16} className="mr-2" /> 主控台
              </button>
            </div>
          </div>
          
          <div className="bg-white p-5 rounded-xl border shadow-sm space-y-4">
            <div>
              <label className="text-sm font-bold block mb-2">项目标题名称</label>
              <input type="text" value={formData.title} onChange={(e) => setFormData({...formData, title: e.target.value})} className="w-full bg-gray-50 border border-gray-300 rounded-lg p-3 text-sm outline-none" placeholder="例如: 5月12日 KidNews 早间版" />
            </div>
            <div>
              <label className="text-sm font-bold block mb-2">1. 挂载主播报音频</label>
              <div className="border border-dashed border-gray-300 rounded-lg bg-gray-50 hover:bg-gray-100 p-6 flex flex-col items-center relative overflow-hidden transition-colors">
                {formData.audioName ? 
                  <div className="text-center"><FileAudio size={32} className="text-blue-500 mx-auto mb-2" /><p className="font-medium text-xs text-gray-700">{formData.audioName}</p></div> : 
                  <div className="text-center text-gray-500"><Upload size={32} className="mx-auto mb-2 text-gray-400" /><p className="text-xs">点击此处加载音频文件</p></div>
                }
                <input type="file" accept="audio/*" className="absolute inset-0 w-full h-full opacity-0 cursor-pointer" onChange={(e) => { const file = e.target.files[0]; if (file) { setFormData(prev => ({...prev, audioFile: file, audioName: file.name, audioUrl: URL.createObjectURL(file)})); } }} />
              </div>
            </div>
            <div>
              <div className="flex justify-between items-end mb-2">
                  <label className="text-sm font-bold block">2. 粘贴原文字幕结构段</label>
                  <button onClick={() => setIsEnSourceRaw(!isEnSourceRaw)} className={`flex items-center text-[11px] font-semibold px-2 py-1 rounded transition-colors ${isEnSourceRaw ? 'bg-blue-100 text-blue-700 border-blue-200' : 'bg-gray-100 text-gray-500 border-gray-200'}`}>
                      {isEnSourceRaw ? <ToggleRight size={14} className="mr-1" /> : <ToggleLeft size={14} className="mr-1" />}
                      {isEnSourceRaw ? '英文字幕强制以原文为准 (替换 AI)' : '英文字幕以 AI 语音识别为准'}
                  </button>
              </div>
              <textarea className="w-full h-24 p-3 text-xs border border-gray-300 rounded-lg resize-none outline-none focus:ring-1 focus:ring-blue-500 bg-gray-50" value={formData.rawText} onChange={e => setFormData({...formData, rawText: e.target.value})} placeholder="粘贴原文..."></textarea>
            </div>
          </div>
          <button onClick={startProcessing} disabled={isProcessing} className="w-full bg-blue-500 text-white rounded-xl py-3.5 font-bold text-base hover:bg-blue-600 transition-all shadow flex items-center justify-center disabled:opacity-50">
            {isProcessing ? <Loader2 className="animate-spin mr-2" size={18} /> : <Play className="mr-2" size={18} />}
            {isProcessing ? "全局引擎协同运转中..." : "启动无损切片解析"}
          </button>
       </div>
    </div>
  );

  // ==========================================
  // ======== B 端工作台：编辑页 ========
  // ==========================================
  const renderStudioWorkspace = () => (
    <div className="flex h-screen w-screen bg-gray-900 text-gray-800 font-sans overflow-hidden relative">
      <div className="w-[450px] h-full p-8 flex flex-col items-center justify-center shrink-0 border-r border-white/10 bg-black/40 relative">
         <div className="absolute top-6 left-8 text-white/50 text-xs font-bold tracking-widest flex items-center">
            <Eye size={14} className="mr-2" /> LIVE PREVIEW (Creator Studio)
         </div>
         <div className="w-[375px] h-[812px] bg-black rounded-[3rem] border-[14px] border-gray-800 shadow-[0_0_50px_rgba(0,0,0,0.5)] relative overflow-hidden flex flex-col ring-1 ring-white/10">
            <div className="absolute top-0 inset-x-0 h-6 bg-gray-800 rounded-b-2xl w-1/2 mx-auto z-50"></div>
            {renderPhoneScreen()}
         </div>
      </div>

      <div className="flex-1 flex flex-col h-full bg-gray-50 relative overflow-hidden">
        {/* 顶部工具栏 */}
        <div className="bg-white border-b border-gray-200 px-6 py-3 flex items-center space-x-4 shrink-0 shadow-sm z-10">
           <button onClick={() => {
                // 💡 直接在这里写死播放逻辑，不再依赖外面的 togglePlay 函数
                if (!audioRef.current) return;
                
                if (isPlaying) {
                    audioRef.current.pause();
                    setIsPlaying(false);
                } else {
                    // 强行启动播放，并加上防报错保护罩
                    audioRef.current.play().then(() => {
                        setIsPlaying(true);
                    }).catch(error => {
                        console.warn("播放失败，可能是音频未就绪:", error);
                        setIsPlaying(false);
                    });
                }
            }} className="w-10 h-10 rounded-full bg-blue-500 flex justify-center items-center hover:bg-blue-600 text-white shrink-0 shadow">
               {isPlaying ? <Pause size={18} fill="currentColor" /> : <Play size={18} fill="currentColor" className="ml-1" />}
            </button>
           <div className="flex-1 space-y-1">
             <input type="range" min="0" max={formData.audioDuration || 1} step="0.01" value={currentTime} onChange={handleSeek} className="w-full h-1.5 bg-gray-200 rounded-full appearance-none cursor-pointer accent-blue-500" />
             <div className="flex justify-between text-[10px] text-gray-500 font-mono font-medium"><span>{formatTime(currentTime)}</span><span>{formData.audioDuration ? formatTime(formData.audioDuration) : '00:00.0'}</span></div>
           </div>
           
           <div className="flex items-center space-x-2">
              <button onClick={() => setAppMode('portal')} className="bg-purple-100 hover:bg-purple-200 text-purple-700 px-3 py-1.5 rounded-lg text-xs font-bold flex items-center shadow-sm transition-colors">
                 <Home size={14} className="mr-1.5"/> 退出后台
              </button>
              <label className="bg-yellow-500 hover:bg-yellow-600 text-white px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center shadow-sm transition-colors cursor-pointer">
                <FileAudio size={14} className="mr-1.5" /> 关联音频
                <input type="file" accept="audio/*" className="hidden" onChange={(e) => { const file = e.target.files[0]; if (file) { setFormData(prev => ({...prev, audioFile: file, audioName: file.name, audioUrl: URL.createObjectURL(file)})); } }} />
              </label>
              <button onClick={() => { 
                  if (audioRef.current) audioRef.current.pause();
                  setIsPlaying(false);
                  setStudioView('dashboard'); 
                  fetchProjects(); 
                }} className="bg-white border border-gray-200 hover:bg-gray-50 text-gray-700 px-4 py-2 rounded-xl text-sm font-bold flex items-center shadow-sm transition-colors">
                 <LayoutDashboard size={16} className="mr-2" /> 主控台
              </button>
              {/* 🎬 补回来的导出视频按钮 */}
              <button 
                onClick={startVideoExport} 
                disabled={isExportingVideo}
                className={`mr-2 px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center shadow-sm transition-colors ${
                  isExportingVideo 
                    ? 'bg-gray-400 cursor-not-allowed' 
                    : 'bg-green-600 hover:bg-green-700 text-white'
                }`}
              >
                {isExportingVideo ? (
                  <>
                    <Loader2 size={14} className="mr-1.5 animate-spin" />
                    正在合成...
                  </>
                ) : (
                  <>
                    <Video size={14} className="mr-1.5" />
                    导出视频
                  </>
                )}
              </button>
              <button onClick={handleSaveProject} className="bg-blue-600 hover:bg-blue-700 text-white px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center shadow-sm transition-colors">
                <Save size={14} className="mr-1.5" /> 保存并发布
              </button>
<button 
  onClick={(e) => {
    e.stopPropagation(); 
    // 💡 关键修改：用当前编辑器的状态数据替换 p
    handleExportSRT({ title: formData.title, sentences: sentences }); 
  }} 
  className="bg-indigo-600 hover:bg-indigo-700 text-white px-3 py-1.5 rounded-lg flex items-center transition-colors"
  title="导出字幕文件"
>
  <svg className="w-4 h-4 mr-1.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
  </svg>
  导出 SRT
</button>
           </div>
        </div>

        {/* 剧本编辑器流 */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6 pb-32">
          {blocks.map((block, bIdx) => {
            const blockSentences = sentences.filter(s => s.blockId === block.id);
            if (blockSentences.length === 0) return null; 
            
            return (
              <div key={block.id} className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden flex flex-col xl:flex-row">
                 <div className="w-full xl:w-[280px] bg-gray-50 border-b xl:border-b-0 xl:border-r border-gray-200 p-4 flex flex-col shrink-0">
                    <div className="flex items-center justify-between mb-3">
                       <input type="text" value={block.title} onChange={(e) => handleRenameBlock(block.id, e.target.value)} className="font-bold text-sm text-gray-800 bg-transparent border-b border-transparent hover:border-gray-300 focus:border-blue-500 outline-none w-2/3 px-1" />
                       {bIdx > 0 && <button onClick={() => handleMergeUp(block.id)} title="与上合并" className="p-1 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded"><ArrowUp size={14} /></button>}
                    </div>
                    <div className="w-full aspect-video bg-black rounded overflow-hidden relative shadow-inner border border-gray-200 mb-3 flex items-center justify-center group">
                       {block.image ? <img src={block.image} className="w-full h-full object-cover" alt="Block Cover" /> : <div className="text-gray-500 flex flex-col items-center"><ImageIcon size={24} className="mb-1 opacity-50" /><span className="text-[10px]">画面媒体位</span></div>}
                    </div>
                    <label className="w-full flex items-center justify-center bg-white border border-gray-300 text-gray-700 hover:text-blue-600 hover:border-blue-400 py-1.5 rounded-lg cursor-pointer text-xs font-semibold shadow-sm transition-colors">
                       <ImagePlus size={14} className="mr-1.5" /> 上传/替换场景图
                       <input type="file" accept="image/*" className="hidden" onChange={(e)=>handleReplaceBlockImage(block.id, e.target.files[0])} />
                    </label>
                 </div>
                 
                 <div className="flex-1 p-4 bg-white max-h-[450px] overflow-y-auto space-y-3 relative">
                    {blockSentences.map((sent, sIdx) => {
                       const sentIdx = sentences.findIndex(s => s.id === sent.id);
                       const isLastOverall = sentIdx === sentences.length - 1;
                       const isSentenceActive = sent.chunks.some(c => currentTime >= c.start && currentTime <= c.end);

                       return (
                          <div key={sent.id}>
                            <div className={`rounded-lg border transition-all duration-200 ${isSentenceActive ? 'border-sky-400 bg-sky-50/20 shadow-md ring-1 ring-sky-200' : 'border-gray-200 bg-white hover:border-gray-300'}`}>
                              
                              <div className={`px-3 py-2 border-b flex flex-col rounded-t-lg ${isSentenceActive ? 'bg-sky-100/40 border-sky-200' : 'bg-gray-50 border-gray-100'}`}>
                                <div className="flex justify-between items-center mb-1">
                                    <span className="text-[10px] font-bold text-blue-500">中文统译轨道</span>
                                    {sentIdx > 0 && sentences[sentIdx - 1].blockId === sent.blockId && (
                                        <button onClick={() => handleMergeSentenceUp(sentIdx)} className="text-[10px] text-blue-600 hover:text-white hover:bg-blue-500 flex items-center bg-blue-100 px-2 py-0.5 rounded transition-colors">
                                            <ArrowUp size={10} className="mr-1"/> 与上句缝合
                                        </button>
                                    )}
                                </div>
                                <textarea value={sent.zh} onChange={(e) => { const n=[...sentences]; n[sentIdx].zh=e.target.value; setSentences(n); }} className="w-full text-xs font-medium text-gray-800 bg-transparent outline-none resize-none leading-relaxed min-h-[30px]" />
                              </div>

                              <div className="p-2 space-y-1.5">
                                <div className="flex items-center justify-between mb-1">
                                    <div className="text-[9px] font-bold text-gray-400">英文强切分轴</div>
                                    <div className="text-[9px] text-yellow-600 font-medium px-1.5 py-0.5 bg-yellow-50 rounded border border-yellow-100">
                                        💡 按 Enter 拆分，首位 Backspace 合并
                                    </div>
                                </div>
                                {sent.chunks.map((chunk, cIdx) => {
                                    const isChunkActive = currentTime >= chunk.start && currentTime <= chunk.end;
                                    return (
                                        <div key={chunk.id} className={`flex items-start space-x-2 rounded p-1.5 border transition-all ${isChunkActive ? 'border-blue-400 bg-blue-50 ring-1 ring-blue-200' : 'border-gray-100 bg-gray-50'}`}>
                                            <div className="flex flex-col space-y-1 w-12 shrink-0">
                                                <input type="number" step="0.1" value={chunk.start.toFixed(1)} onChange={(e) => { const n=[...sentences]; n[sentIdx].chunks[cIdx].start=parseFloat(e.target.value)||0; setSentences(n); }} className="w-full text-[9px] font-mono text-center bg-white border border-gray-200 rounded focus:border-blue-400 outline-none p-0.5" />
                                                <input type="number" step="0.1" value={chunk.end.toFixed(1)} onChange={(e) => { const n=[...sentences]; n[sentIdx].chunks[cIdx].end=parseFloat(e.target.value)||0; setSentences(n); }} className="w-full text-[9px] font-mono text-center bg-white border border-gray-200 rounded focus:border-blue-400 outline-none p-0.5" />
                                            </div>
                                            <textarea 
                                                value={chunk.en} 
                                                onKeyDown={(e) => handleChunkKeyDown(e, sentIdx, cIdx)}
                                                onChange={(e) => { const n=[...sentences]; n[sentIdx].chunks[cIdx].en=e.target.value; n[sentIdx].en = n[sentIdx].chunks.map(c=>c.en).join(" "); setSentences(n); }} 
                                                className="flex-1 text-[11px] font-medium text-gray-800 bg-transparent outline-none resize-none h-[30px]" 
                                            />
                                        </div>
                                    )
                                })}
                              </div>

                            </div>

                            {!isLastOverall && (
                              <div className="flex justify-center my-1 relative group py-1">
                                <div className="absolute inset-0 flex items-center"><div className="w-full border-t border-dashed border-gray-200 group-hover:border-blue-300 transition-colors"></div></div>
                                <button onClick={() => handleSplitAfter(sent.id, block.id)} className="relative bg-white border border-gray-200 text-gray-500 group-hover:text-blue-500 group-hover:border-blue-400 group-hover:shadow-sm text-[10px] px-2 py-0.5 rounded-full font-medium transition-all flex items-center opacity-0 group-hover:opacity-100">
                                  <Scissors size={10} className="mr-1" /> 在此向下拆出新段落 (News Block)
                                </button>
                              </div>
                            )}
                          </div>
                       )
                    })}
                 </div>
              </div>
            )
          })}
        </div>
      </div>
    </div>
  );

  // ==========================================
  // ======== 终极返回：路由渲染架构 ========
  // ==========================================
  return (
    <>
      <audio 
        key={formData.audioUrl || 'empty-audio'} 
        ref={audioRef} 
        src={formData.audioUrl || undefined} 
        onTimeUpdate={handleTimeUpdate} 
        onLoadedMetadata={(e) => setFormData(prev => ({...prev, audioDuration: e.target.duration}))} 
        onEnded={() => setIsPlaying(false)} 
        onPause={() => setIsPlaying(false)} 
        onPlay={() => setIsPlaying(true)} 
        style={{ display: 'none' }} 
      />
      <canvas ref={exportCanvasRef} width={1080} height={1920} className="hidden pointer-events-none" />

      {/* 导出视频遮罩 */}
      {isExportingVideo && (
        <div className="fixed inset-0 z-[200] bg-black/80 flex flex-col items-center justify-center text-white backdrop-blur-sm">
            <Loader2 size={64} className="animate-spin text-green-500 mb-6" />
            <h2 className="text-3xl font-bold mb-3 tracking-wide">正在实时渲染并导出视频...</h2>
            <p className="text-gray-300 mb-8 font-medium">请勿关闭页面，此过程需要与音频实际播放等长的时间</p>
            <div className="w-96 h-3 bg-gray-800 rounded-full overflow-hidden shadow-inner">
                <div className="h-full bg-green-500 transition-all duration-300" style={{ width: `${exportProgress * 100}%` }}></div>
            </div>
            <p className="mt-4 text-xl font-mono text-green-400">{Math.round(exportProgress * 100)}%</p>
        </div>
      )}

      {/* 草稿箱 Modal */}
      {showList && (
        <div className="fixed inset-0 z-[100] bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white w-full max-w-xl rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[80vh]">
            <div className="px-6 py-4 border-b border-gray-100 flex justify-between items-center bg-gray-50">
              <h3 className="font-bold text-gray-800 text-lg flex items-center"><FolderOpen className="mr-2 text-blue-500" size={20}/> 我的云端项目</h3>
              <button onClick={() => setShowList(false)} className="text-gray-400 hover:text-gray-600 transition-colors bg-white hover:bg-gray-100 p-1 rounded-md"><X size={20} /></button>
            </div>
            <div className="overflow-y-auto p-4 space-y-2 flex-1 bg-slate-50/50">
              {isLoadingList ? (
                <div className="flex flex-col justify-center items-center py-12"><Loader2 className="animate-spin text-blue-500 mb-3" size={32} /></div>
              ) : projectList.length > 0 ? (
                projectList.map((p) => (
                  <div key={p.id} onClick={() => loadProject(p.id)} className="p-4 bg-white border border-gray-100 hover:border-blue-300 hover:shadow-md rounded-xl cursor-pointer transition-all flex justify-between items-center group">
                    <div>
                      <div className="font-bold text-gray-800 group-hover:text-blue-600 transition-colors">{p.title || '未命名草稿'}</div>
                      <div className="text-xs text-gray-400 mt-1.5 flex gap-3 items-center"><span className="flex items-center"><Clock size={12} className="mr-1"/> {new Date(p.updatedAt).toLocaleDateString()}</span></div>
                    </div>
                    <div className="text-sm font-bold text-blue-500 opacity-0 group-hover:opacity-100 transition-opacity bg-blue-50 px-4 py-1.5 rounded-lg border border-blue-100">载入项目</div>
                  </div>
                ))
              ) : (
                <div className="text-center py-12 text-gray-400"><FolderOpen size={48} className="mx-auto mb-3 text-gray-300" /><p className="font-medium">还没有保存过任何草稿</p></div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* 词汇课研实验室 Modal */}
      {showVocabLab && (
        <div className="fixed inset-0 z-[100] bg-slate-900/70 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white w-full max-w-3xl rounded-3xl shadow-2xl overflow-hidden flex flex-col max-h-[85vh] animate-in zoom-in-95 duration-200">
            <div className="px-6 py-5 border-b border-gray-100 flex justify-between items-center bg-gradient-to-r from-purple-50 to-white">
              <div>
                <h3 className="font-black text-gray-800 text-xl flex items-center"><Sparkles className="mr-2 text-purple-600" size={24}/> AI 词汇课研实验室</h3>
                <p className="text-xs text-gray-500 mt-1 font-medium">精准定制，告别死记硬背</p>
              </div>
              <button onClick={() => setShowVocabLab(false)} className="text-gray-400 hover:text-gray-700 bg-white hover:bg-gray-100 p-2 rounded-xl shadow-sm"><X size={20} /></button>
            </div>
            <div className="overflow-y-auto p-6 flex-1 bg-slate-50">
              {isVocabLoading ? (
                <div className="flex flex-col justify-center items-center py-20"><Loader2 className="animate-spin text-purple-600 mb-4" size={48} /><p className="text-sm font-bold text-gray-600">AI 正在深度思考...</p></div>
              ) : vocabPhase === 'select' ? (
                <div>
                  <div className="bg-purple-100 text-purple-800 text-sm font-bold px-4 py-3 rounded-xl mb-6 flex justify-between items-center">
                    <span>💡 AI 已提取出这篇新闻的核心词汇，请挑选（建议 5-10 个）：</span><span className="bg-purple-600 text-white px-2 py-1 rounded-md text-xs">已选 {selectedWords.length} 词</span>
                  </div>
                  <div className="flex flex-wrap gap-3">
                    {candidateWords.map((word, idx) => {
                      const isSelected = selectedWords.includes(word);
                      return (<button key={idx} onClick={() => toggleWordSelection(word)} className={`flex items-center px-4 py-2.5 rounded-xl border-2 text-sm font-bold transition-all ${isSelected ? 'bg-purple-50 border-purple-500 text-purple-700 shadow-sm' : 'bg-white border-gray-200 text-gray-600'}`}>{isSelected ? <CheckSquare size={16} className="mr-2 text-purple-600"/> : <Square size={16} className="mr-2 text-gray-300"/>}{word}</button>)
                    })}
                  </div>
                </div>
              ) : (
                <div className="space-y-6">
                  <div className="flex justify-between items-end mb-2">
                    <h4 className="font-black text-lg text-gray-800">深度学习卡片 ({vocabCards.length})</h4>
                    <button onClick={() => setVocabPhase('select')} className="text-sm font-bold text-purple-600 hover:underline">&larr; 重新挑选</button>
                  </div>
                  {vocabCards.map((card, idx) => (
                    <div key={idx} className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100 hover:shadow-md transition-shadow">
                      <div className="flex items-end mb-4 pb-4 border-b border-gray-50">
                        <h2 className="text-3xl font-black text-purple-700 mr-4">{card.word}</h2><span className="text-gray-400 font-mono text-sm mb-1">{card.phonetic}</span>
                      </div>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <div>
                          <p className="text-[15px] font-bold text-gray-800 mb-1">🇨🇳 {card.zh}</p><p className="text-[13px] text-gray-500 italic mb-4">🇬🇧 {card.en}</p>
                          <div className="bg-blue-50/50 p-3 rounded-xl border border-blue-100">
                            <p className="text-[11px] font-black text-blue-600 uppercase tracking-widest mb-2">📝 高频词组 / Phrase</p>
                            <ul className="space-y-1.5">{card.phrases?.map((phrase, pIdx) => (<li key={pIdx} className="text-sm font-medium text-gray-700 flex items-start"><span className="text-blue-400 mr-1.5">•</span> {phrase}</li>))}</ul>
                          </div>
                        </div>
                        <div className="bg-gray-50 p-4 rounded-xl border border-gray-100 flex flex-col justify-center">
                          <p className="text-[11px] font-black text-gray-400 uppercase tracking-widest mb-2">🗣️ 例句 / Example</p><p className="text-sm font-bold text-gray-700 leading-relaxed">"{card.example}"</p>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
            {vocabPhase === 'select' && (
              <div className="px-6 py-4 border-t border-gray-100 bg-white flex justify-end">
                <button onClick={handleGenerateVocabCards} disabled={selectedWords.length === 0 || isVocabLoading} className="bg-purple-600 hover:bg-purple-700 text-white font-bold py-3 px-8 rounded-xl shadow-lg transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center">
                  生成深度解析卡片 <ChevronLeft size={18} className="ml-2 rotate-180" />
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* 页面主路由 */}
      {appMode === 'portal' ? (
          portalView === 'home' ? renderPortalHome() : renderPortalDetail()
      ) : (
          studioView === 'dashboard' ? renderStudioDashboard() :
          studioView === 'create' ? renderStudioUpload() :
          renderStudioWorkspace()
      )}
      </>
  );
}