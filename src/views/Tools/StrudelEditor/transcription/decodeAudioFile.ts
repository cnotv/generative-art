import { TRANSCRIPTION_MAX_SECONDS, TRANSCRIPTION_SAMPLE_RATE } from '../config'

/**
 * Averages every channel into one mono signal.
 * @param channels - sample data per channel, all the same length
 * @returns the mono samples
 */
export const downmixChannels = (channels: Float32Array[]): Float32Array =>
  Float32Array.from(
    { length: channels[0]?.length ?? 0 },
    (_, sampleIndex) =>
      channels.reduce((sum, channel) => sum + channel[sampleIndex], 0) / channels.length
  )

/**
 * Decodes any format the browser supports (MP3, WAV, OGG, ...) to mono at the analysis
 * rate. decodeAudioData already resamples to its context's rate, so the offline context
 * never has to render. It cannot run in a worker, which is why this stays on the main
 * thread and the worker only receives the samples.
 * @param audioFile - the uploaded file
 * @returns mono samples, capped at the analysis length
 */
export const decodeAudioFile = async (audioFile: File): Promise<Float32Array> => {
  const decodingContext = new OfflineAudioContext(1, 1, TRANSCRIPTION_SAMPLE_RATE)
  const audioBuffer = await decodingContext.decodeAudioData(await audioFile.arrayBuffer())
  const channels = Array.from({ length: audioBuffer.numberOfChannels }, (_, channelIndex) =>
    audioBuffer
      .getChannelData(channelIndex)
      .subarray(0, TRANSCRIPTION_MAX_SECONDS * TRANSCRIPTION_SAMPLE_RATE)
  )
  return downmixChannels(channels)
}
