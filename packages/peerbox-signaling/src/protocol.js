export const CLIENT_MESSAGE_TYPES = Object.freeze({
  CREATE: "create",
  HOST_RESUME: "host-resume",
  HOST_DISCONNECTED: "host-disconnected",
  CLIENT_DISCONNECTED: "client-disconnected",
  JOIN: "join",
  SIGNAL: "signal",
});

export const SERVER_MESSAGE_TYPES = Object.freeze({
  ROOM_CREATED: "room-created",
  HOST_RESUMED: "host-resumed",
  HOST_RESUME_REJECTED: "host-resume-rejected",
  JOIN_ACCEPTED: "join-accepted",
  JOIN_REJECTED: "join-rejected",
  SIGNAL: "signal",
  ERROR: "error",
});
