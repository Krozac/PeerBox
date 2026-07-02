// peerbox-voice/index.js
import HostVoiceManager from "./host/hostVoiceManager";
import ClientVoiceManager from "./client/clientVoiceManager";

export default function VoicePlugin() {
  return {
    name: "voice",

    install({ host, client }) {
      console.log("Installing VoicePlugin for", host ? "host" : "client");

      if (client) {
        client.plugins.registerPlugin(new ClientVoiceManager(client));
      }

      if (host) {
        host.plugins.registerPlugin(new HostVoiceManager(host));
      }
    }
  };
}

