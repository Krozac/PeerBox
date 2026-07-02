import VoiceManager from "../shared/voiceManager";

export default class HostVoiceManager extends VoiceManager {
    constructor(host) {
        super();

        this.host = host;
    }

    broadcast(stream, { exclude } = {}) {
        this.host.peers.addTrackToAll(stream, exclude);
    }

    send(stream,clientId) {
        this.host.peers.addTrackToPeer(stream, clientId);
    }
}