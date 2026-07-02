export function ChatComponent({ chatId, chatName = 'Default Chat' }) {
  return {
    chatId,
    chatName,
    messages: [], // optional: could track message entity IDs here
  };
}
