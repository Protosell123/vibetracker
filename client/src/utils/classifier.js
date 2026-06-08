/**
 * Classifier utilities for RuTracker Audio Hub
 * Dynamically categorizes plugins and sample packs based on their titles and raw titles.
 */

export function getPluginFunction(title, rawTitle) {
  const t = `${title || ''} ${rawTitle || ''}`.toLowerCase();
  
  if (t.includes('reverb') || t.includes('space') || t.includes('room') || t.includes('valhalla')) {
    return { id: 'reverb', label: 'Reverbs', icon: '🌌' };
  }
  if (t.includes('delay') || t.includes('echo')) {
    return { id: 'delay', label: 'Delays & Echoes', icon: '⏳' };
  }
  if (t.includes('equalizer') || t.includes(' eq') || t.includes('eq ') || t.includes('filter') || t.includes('phase align')) {
    return { id: 'eq', label: 'EQs & Filters', icon: '🎚️' };
  }
  if (t.includes('compressor') || t.includes('limiter') || t.includes('gate') || t.includes('deesser') || t.includes('de-esser') || t.includes('dynamics') || t.includes('maximizer') || t.includes('transient')) {
    return { id: 'compressor', label: 'Compressors & Dynamics', icon: '🗜️' };
  }
  if (t.includes('distortion') || t.includes('saturation') || t.includes('overdrive') || t.includes('amp') || t.includes('tape') || t.includes('fuzz') || t.includes('clipper') || t.includes('preamp') || t.includes('crusher') || t.includes('lofi') || t.includes('lo-fi')) {
    return { id: 'distortion', label: 'Distortion & Saturation', icon: '⚡' };
  }
  if (t.includes('vocal') || t.includes('pitch') || t.includes('autotune') || t.includes('vocoder') || t.includes('vocalign') || t.includes('tune') || t.includes('tuning') || t.includes('harmony') || t.includes('harmonizer')) {
    return { id: 'vocal', label: 'Vocal & Pitch', icon: '🗣️' };
  }
  if (t.includes('synth') || t.includes('synthesizer') || t.includes('instrument') || t.includes('piano') || t.includes('keys') || t.includes('organ') || t.includes('kontakt') || t.includes('drum machine') || t.includes('sampler') || t.includes('workstation') || t.includes('wavetable')) {
    return { id: 'synth', label: 'Synths & Instruments', icon: '🎹' };
  }
  if (t.includes('chorus') || t.includes('flanger') || t.includes('phaser') || t.includes('tremolo') || t.includes('rotary') || t.includes('vibrato') || t.includes('modulation') || t.includes('pan ') || t.includes('autopan') || t.includes('panner')) {
    return { id: 'modulation', label: 'Modulation', icon: '🌀' };
  }
  if (t.includes('mastering') || t.includes('utility') || t.includes('analyzer') || t.includes('meter') || t.includes('metering') || t.includes('scope') || t.includes('spectral') || t.includes('binaural') || t.includes('spatial')) {
    return { id: 'mastering', label: 'Mastering & Tools', icon: '📈' };
  }
  
  return { id: 'other', label: 'Other Plugins', icon: '🎛️' };
}

export function getSampleType(title, rawTitle) {
  const t = `${title || ''} ${rawTitle || ''}`.toLowerCase();
  
  if (t.includes('kick') || t.includes('sub kick') || t.includes('kicks')) {
    return { id: 'kicks', label: 'Kicks', icon: '🦶' };
  }
  if (t.includes('drum') || t.includes('snare') || t.includes('hihat') || t.includes('hats') || t.includes('cymbal') || t.includes('percussion') || t.includes('clap') || t.includes('tom') || t.includes('rim') || t.includes('shaker')) {
    return { id: 'drums', label: 'Drums', icon: '🥁' };
  }
  if (t.includes('loop') || t.includes('loops') || t.includes('groove')) {
    return { id: 'loops', label: 'Loops', icon: '🔄' };
  }
  if (t.includes('one shot') || t.includes('oneshot') || t.includes('one-shot')) {
    return { id: 'one-shots', label: 'One-shots', icon: '🎯' };
  }
  if (t.includes('vocal') || t.includes('voice') || t.includes('acapella') || t.includes('chant') || t.includes('phrase') || t.includes('vocals') || t.includes('spoken')) {
    return { id: 'vocals', label: 'Vocals', icon: '🎤' };
  }
  if (t.includes('preset') || t.includes('presets') || t.includes('serum') || t.includes('massive') || t.includes('sylenth') || t.includes('spire') || t.includes('soundbank') || t.includes('bank') || t.includes('patches') || t.includes('h2p')) {
    return { id: 'presets', label: 'Synth Presets', icon: '🎛️' };
  }
  if (t.includes('melody') || t.includes('midi') || t.includes('chord') || t.includes('progression') || t.includes('melodies') || t.includes('stems')) {
    return { id: 'melodies', label: 'Melodies & MIDI', icon: '🎼' };
  }
  if (t.includes('fx') || t.includes('transition') || t.includes('riser') || t.includes('impact') || t.includes('cinematic') || t.includes('noise') || t.includes('sfx') || t.includes('sweep') || t.includes('ambience') || t.includes('ambient') || t.includes('drone')) {
    return { id: 'fx', label: 'FX & Cinematic', icon: '💥' };
  }
  
  return { id: 'other', label: 'Other Samples', icon: '📦' };
}
