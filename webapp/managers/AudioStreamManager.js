// Copyright 2025 Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: MIT-0
import { LOGGER_PREFIX } from "../constants";
import { isStringUndefinedNullEmpty } from "../utils/commonUtility";

export class AudioStreamManager {
  constructor(audioElement, audioContext) {
    this.audioContext = audioContext;
    this.mediaStreamDestination = this.audioContext.createMediaStreamDestination();
    this.audioElement = audioElement;

    // Master compressor — all sources route through this before destination
    this.masterCompressor = this.audioContext.createDynamicsCompressor();
    this.masterCompressor.threshold.value = -24;   // start compressing at -24dBFS
    this.masterCompressor.knee.value = 30;         // soft knee for natural sound
    this.masterCompressor.ratio.value = 12;        // 12:1 ratio — fairly aggressive
    this.masterCompressor.attack.value = 0.003;    // 3ms attack
    this.masterCompressor.release.value = 0.25;    // 250ms release
    this.masterCompressor.connect(this.mediaStreamDestination);

    // Set up permanent stream
    this.audioElement.srcObject = this.mediaStreamDestination.stream;
    // Store the audio track
    this.audioTrack = this.mediaStreamDestination.stream.getAudioTracks()[0];
    this.audioElement.play();

    // Queue for managing multiple audio requests
    this.audioQueue = [];
    this.isPlaying = false;

    this.audioFeedbackNode = null;
    this.shouldPlayAudioFeedback = false;

    this.microphoneStream = null;
    this.microphoneGain = null;
    this.isMicrophoneActive = false;
    this.activeMicrophoneDeviceId;

    this.customFeedbackBuffer = null;

    this._playbackChain = Promise.resolve();
    this.customFeedbackBuffer = null;

    this._chunkBuffer = [];
    this._bufferFlushed = false;
    this.BUFFER_TARGET_MS = 300;
    this.BUFFER_TARGET_SAMPLES = (16000 * this.BUFFER_TARGET_MS) / 1000;
  }

  async startMicrophone(microphoneConstraints) {
    try {
      const microphoneDeviceId = microphoneConstraints?.audio?.deviceId;
      if (microphoneDeviceId == null) throw new Error("Microphone deviceId not provided!");

      if (this.isMicrophoneActive) {
        if (this.activeMicrophoneDeviceId === microphoneDeviceId) {
          console.info(`${LOGGER_PREFIX} - Microphone [${microphoneDeviceId}] already active`);
          return;
        } else {
          this.stopMicrophone();
        }
      }

      // Get microphone stream
      this.activeMicrophoneDeviceId = microphoneDeviceId;
      const stream = await navigator.mediaDevices.getUserMedia(microphoneConstraints);

      // Create source from microphone
      const micSource = this.audioContext.createMediaStreamSource(stream);

      // Create gain node for microphone volume control
      this.microphoneGain = this.audioContext.createGain();
      this.microphoneGain.gain.setValueAtTime(1.0, this.audioContext.currentTime);

      // Connect microphone through gain to destination
      micSource.connect(this.microphoneGain);
      this.microphoneGain.connect(this.masterCompressor);

      // Store stream for cleanup
      this.microphoneStream = stream;
      this.isMicrophoneActive = true;

      console.info(`${LOGGER_PREFIX} - Microphone started successfully`);
    } catch (error) {
      console.error(`${LOGGER_PREFIX} - Error starting microphone:`, error);
      throw error;
    }
  }

  stopMicrophone() {
    if (!this.isMicrophoneActive) return;

    if (this.microphoneStream) {
      // Stop all audio tracks
      this.microphoneStream.getTracks().forEach((track) => track.stop());
      this.microphoneStream = null;
    }

    if (this.microphoneGain) {
      this.microphoneGain.disconnect();
      this.microphoneGain = null;
    }

    this.isMicrophoneActive = false;
    this.activeMicrophoneDeviceId = null;
    console.info(`${LOGGER_PREFIX} - Microphone stopped`);
  }

  setMicrophoneVolume(volume) {
    if (this.microphoneGain && volume >= 0 && volume <= 1) {
      this.microphoneGain.gain.setValueAtTime(volume, this.audioContext.currentTime);
    }
  }

  isMicrophoneEnabled() {
    return this.isMicrophoneActive;
  }

  async loadAudioFile(filePath) {
    try {
      if (isStringUndefinedNullEmpty(filePath)) throw new Error("Invalid file path");

      const response = await fetch(filePath);
      let reader = response.body.getReader();
      let chunks = [];
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        chunks.push(value);
      }
      let blob = new Blob(chunks);
      let arrayBuffer = await blob.arrayBuffer();
      const audioBuffer = await this.audioContext.decodeAudioData(arrayBuffer);

      return audioBuffer;
    } catch (error) {
      console.error(`${LOGGER_PREFIX} - Error loading audio file:`, error);
      throw error;
    }
  }

  // Create audio feedback
  createAudioFeedback() {
    if (this.customFeedbackBuffer) {
      const audioFeedback = this.audioContext.createBufferSource();
      audioFeedback.buffer = this.customFeedbackBuffer;
      audioFeedback.loop = true;

      // Add gain node to control volume
      const gainNode = this.audioContext.createGain();
      gainNode.gain.value = 0.05; // Adjust volume here (0-1)

      audioFeedback.connect(gainNode);
      gainNode.connect(this.masterCompressor);
      return audioFeedback;
    }

    const bufferSize = 2 * this.audioContext.sampleRate;
    const audioFeedbackBuffer = this.audioContext.createBuffer(1, bufferSize, this.audioContext.sampleRate);
    const output = audioFeedbackBuffer.getChannelData(0);

    for (let i = 0; i < bufferSize; i++) {
      output[i] = Math.random() * 2 - 1;
    }

    const audioFeedback = this.audioContext.createBufferSource();
    audioFeedback.buffer = audioFeedbackBuffer;
    audioFeedback.loop = true;

    // Add gain node to control volume
    const gainNode = this.audioContext.createGain();
    gainNode.gain.value = 0.005; // Adjust volume here (0-1)

    audioFeedback.connect(gainNode);
    gainNode.connect(this.masterCompressor);

    console.info(`${LOGGER_PREFIX} - createAudioFeedback - white noise:`, audioFeedback);
    return audioFeedback;
  }

  startAudioFeedback() {
    //console.info(`${LOGGER_PREFIX} - startAudioFeedback`);
    if (!this.audioFeedbackNode) {
      this.audioFeedbackNode = this.createAudioFeedback();
      this.audioFeedbackNode.start();
    }
  }

  stopAudioFeedback() {
    if (this.audioFeedbackNode) {
      //console.info(`${LOGGER_PREFIX} - stopAudioFeedback`);
      this.audioFeedbackNode.stop();
      this.audioFeedbackNode = null;
    }
  }

  async enableAudioFeedback(filePath = null) {
    if (filePath != null) {
      try {
        this.customFeedbackBuffer = await this.loadAudioFile(filePath);
      } catch (error) {
        console.error(`${LOGGER_PREFIX} - Failed to load custom audio feedback:`, error);
        this.customFeedbackBuffer = null;
        // Continue with default white noise
      }
    } else {
      this.customFeedbackBuffer = null;
    }

    console.info(`${LOGGER_PREFIX} - enableAudioFeedback`);
    this.shouldPlayAudioFeedback = true;
    if (!this.isPlaying) {
      this.startAudioFeedback();
    }
  }

  disableAudioFeedback() {
    console.info(`${LOGGER_PREFIX} - disableAudioFeedback`);
    this.shouldPlayAudioFeedback = false;
    this.stopAudioFeedback();
  }

  // Getter for the audio track
  getAudioTrack() {
    return this.audioTrack;
  }

  async playAudio(audioData, volume = 1.0) {
    return new Promise(async (resolve, reject) => {
      try {
        const audioDataArray = await audioData.transformToByteArray();
        const audioBuffer = await this.audioContext.decodeAudioData(audioDataArray.buffer);

        // Add to queue
        this.audioQueue.push({
          buffer: audioBuffer,
          volume: volume,
          resolve: resolve,
        });

        // Start processing queue if not already playing
        if (!this.isPlaying) {
          this.processQueue();
        }
      } catch (error) {
        reject(error);
      }
    });
  }

  playAudioBuffer(arrayBuffer, volume = 1.0) {
    const pcmData = new Int16Array(arrayBuffer.buffer, arrayBuffer.byteOffset, arrayBuffer.byteLength / 2);
    
    this._chunkBuffer.push({ arrayBuffer, volume, samples: pcmData.length });

    const totalSamples = this._chunkBuffer.reduce((sum, c) => sum + c.samples, 0);

    if (!this._bufferFlushed && totalSamples >= this.BUFFER_TARGET_SAMPLES) {
      this._bufferFlushed = true;
      // Flush all buffered chunks then continue scheduling normally
      for (const chunk of this._chunkBuffer) {
        this._playbackChain = this._playbackChain.then(() =>
          this._processChunk(chunk.arrayBuffer, chunk.volume)
        );
      }
      this._chunkBuffer = [];
    } else if (this._bufferFlushed) {
      // Already playing, schedule directly
      this._playbackChain = this._playbackChain.then(() =>
        this._processChunk(arrayBuffer, volume)
      );
    }
    // else: still buffering, just accumulate
  }

  async _processChunk(arrayBuffer, volume = 1.0) {
      try {
          clearTimeout(this.resetTimer);
          this.stopAudioFeedback();

          const pcmData = new Int16Array(arrayBuffer.buffer, arrayBuffer.byteOffset, arrayBuffer.byteLength / 2);
          const floatData = new Float32Array(pcmData.length);
          for (let i = 0; i < pcmData.length; i++) {
              floatData[i] = pcmData[i] / 32768.0;
          }

          const audioBuffer = this.audioContext.createBuffer(1, floatData.length, 16000);
          audioBuffer.getChannelData(0).set(floatData);

          const source = this.audioContext.createBufferSource();
          const gainNode = this.audioContext.createGain();
          gainNode.gain.value = volume;
          source.buffer = audioBuffer;
          source.connect(gainNode);
          gainNode.connect(this.masterCompressor);

          const now = this.audioContext.currentTime;
          const startAt = Math.max(this.nextStartTime || now, now);
          const aheadBy = startAt - now;
          source.playbackRate.value = 1.0; // always 1.0 — no pitch shift ever
          source.start(startAt);
          this.nextStartTime = startAt + audioBuffer.duration;

          this.resetTimer = setTimeout(() => {
              this.nextStartTime = this.audioContext.currentTime;
              this._bufferFlushed = false; // re-enable buffering for next utterance
              this._chunkBuffer = [];
              if (this.shouldPlayAudioFeedback) this.startAudioFeedback();
          }, Math.max(500, aheadBy * 1000 + 500)); // wait until scheduled audio is actually done + 500ms grace period

      } catch (error) {
          console.error('Error playing audio buffer:', error);
      }
  }

  async processQueue() {
    if (this.audioQueue.length === 0) {
      this.isPlaying = false;
      // Start audio feedback when queue is empty
      if (this.shouldPlayAudioFeedback) {
        this.startAudioFeedback();
      }
      return;
    }

    // Stop audio feedback when there's something to play
    this.stopAudioFeedback();

    this.isPlaying = true;
    const current = this.audioQueue.shift();

    // Create and set up source
    const bufferSource = this.audioContext.createBufferSource();
    bufferSource.buffer = current.buffer;

    // Create gain node for volume control
    const gainNode = this.audioContext.createGain();
    gainNode.gain.value = current.volume; // Set the volume (0.0 to 1.0)

    bufferSource.connect(gainNode);
    gainNode.connect(this.masterCompressor);

    //bufferSource.connect(this.mediaStreamDestination);

    // Handle completion
    bufferSource.onended = () => {
      current.resolve();
      this.processQueue();
    };

    // Start playing
    bufferSource.start();
  }

  async resume() {
    if (this.audioContext.state === "suspended") {
      await this.audioContext.resume();
    }
  }

  async suspend() {
    if (this.audioContext.state === "running") {
      await this.audioContext.suspend();
    }
  }

  clearQueue() {
    this.audioQueue = [];
  }

  getState() {
    return {
      contextState: this.audioContext.state,
      queueLength: this.audioQueue.length,
      isPlaying: this.isPlaying,
      currentTime: this.audioContext.currentTime,
    };
  }

  //Clean up resources
  async dispose() {
    console.info(`${LOGGER_PREFIX} - dispose - AudioStreamManager disposed`);
    this.clearQueue();
    this.stopAudioFeedback();
    this.stopMicrophone();
    this.masterCompressor.disconnect();
    if (this.audioTrack != null) {
      this.audioTrack.stop();
    }
  }

  // Mute methods
  muteTrack() {
    if (this.audioTrack) {
      this.audioTrack.enabled = false;
    }
  }

  unmuteTrack() {
    if (this.audioTrack) {
      this.audioTrack.enabled = true;
    }
  }

  toggleTrackMute() {
    if (this.audioTrack) {
      this.audioTrack.enabled = !this.audioTrack.enabled;
    }
  }

  isTrackMuted() {
    return this.audioTrack ? !this.audioTrack.enabled : true;
  }

  muteAudioElement() {
    if (this.audioElement) {
      this.audioElement.muted = true;
    }
  }

  unmuteAudioElement() {
    if (this.audioElement) {
      this.audioElement.muted = false;
    }
  }

  toggleAudioElementMute() {
    if (this.audioElement) {
      this.audioElement.muted = !this.audioElement.muted;
    }
  }

  isAudioElementMuted() {
    return this.audioElement ? this.audioElement.muted : true;
  }
}
