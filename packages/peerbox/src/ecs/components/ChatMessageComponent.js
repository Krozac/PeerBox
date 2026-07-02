export function ChatMessageComponent({ username, message, timestamp = Date.now(), chatId = 'default' , autoScroll = true } = {}) {
  return {
    username,
    message,
    timestamp,
    chatId,
    autoScroll,
  };
}