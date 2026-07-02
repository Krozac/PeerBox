import VoiceManager from "../shared/voiceManager";

export default class ClientVoiceManager extends VoiceManager {
    constructor(client) {
        super();
        
        this.client = client;
        this.stream = null;
        this.remoteStreams = new Map();

        this._setup();
    }

    _setup() {
        this.client.peer.on("track", ({ stream, track }) => {
            this.remoteStreams.set(track.id, stream);
        });
    }

    async enableMicrophone() {
        if (this.stream) return this.stream;

        this.stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        await this.stream.getAudioTracks()[0].applyConstraints({
            echoCancellation: true,
            noiseSuppression: true,
            autoGainControl: true
        });

        const pc = this.client.peer.pc;

        for (const track of this.stream.getTracks()) {
            pc.addTrack(track, this.stream);
        }

        console.log("Renegotiating after enabling microphone...");

        await this.client.peer.renegotiate();
        return this.stream;
    }

    disableMicrophone() {
        if (!this.stream) return;

        this.stream.getTracks().forEach(track => track.stop());
        this.stream = null;
    }

    mute() {
        this.stream?.getAudioTracks().forEach(track => track.enabled = false);
    }

    unmute() {
        this.stream?.getAudioTracks().forEach(track => track.enabled = true);
    }
}