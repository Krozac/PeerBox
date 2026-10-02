"use strict";

const WebSocket = require("ws");
const express = require("express");
const cors = require("cors");
const { randomBytes } = require("node:crypto");
const { v4: uuidv4 } = require("uuid");

const {
	CLIENT_MESSAGE_TYPES: C,
	SERVER_MESSAGE_TYPES: S,
} = require("./protocol.cjs");

function	generateRoomId(length = 5) {
	const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
	let id = "";

	for (let i = 0; i < length; i++) {
		id += alphabet[randomBytes(1)[0] % alphabet.length];
	}

	return id;
}

function	createSignalingServer(options = {}) {
	const {
		port = 5501,
		apiPort = 5502,
		maxClients = 8,
		games = {},
		corsOptions,
		authenticateJoin,
		issueJoinToken,
		verifyJoinToken,
		roomIdGenerator = generateRoomId,
		hostReconnectGracePeriod = 120000,
		reconnectGracePeriod = 120000,
		onRoomCreated,
		onRoomClosed,
	} = options;

	if (
		typeof verifyJoinToken !== "function" ||
		typeof issueJoinToken !== "function"
	) {
		throw new TypeError(
			"createSignalingServer requires issueJoinToken and verifyJoinToken callbacks",
		);
	}

	const rooms = new Map();
	const pendingDisconnects = new Map();

	const wss = new WebSocket.Server({ port });

	const send = (ws, message) => {
		if (ws?.readyState !== WebSocket.OPEN) {
			return;
		}

		ws.send(JSON.stringify(message));
	};

	const keyFor = (roomId, userId) => `${roomId}:${userId}`;

	function	closeRoom(roomId, reason = "host-timeout") {
		const room = rooms.get(roomId);

		if (!room) {
			return;
		}

		clearTimeout(room.hostDisconnectTimer);

		for (const [userId, ws] of room.clients) {
			send(ws, {
				type: "room-closed",
				roomId,
				reason,
			});

			const key = keyFor(roomId, userId);
			const pending = pendingDisconnects.get(key);

			if (pending) {
				clearTimeout(pending.timer);
			}

			pendingDisconnects.delete(key);
		}

		rooms.delete(roomId);

		onRoomClosed?.({
			roomId,
			gameId: room.gameId,
			reason,
		});
	}

	function	handleCreate(ws, data) {
		if (ws.role) {
			send(ws, {
				type: S.ERROR,
				message: "Socket already joined a room",
			});

			return;
		}

		if (
			data?.gameId &&
			Object.keys(games).length &&
			!Object.hasOwn(games, data.gameId)
		) {
			send(ws, {
				type: S.ERROR,
				message: "Unknown gameId",
			});

			return;
		}

		let roomId;

		do {
			roomId = roomIdGenerator();
		} while (rooms.has(roomId));

		const room = {
			host: ws,
			hostId: uuidv4(),
			hostToken: randomBytes(32).toString("hex"),
			hostDisconnectTimer: null,
			clients: new Map(),
			gameId: data?.gameId || null,
			pendingPeerEvents: [],
		};

		rooms.set(roomId, room);

		Object.assign(ws, {
			role: "host",
			roomId,
			userId: room.hostId,
		});

		send(ws, {
			type: S.ROOM_CREATED,
			roomId,
			hostId: room.hostId,
			userId: room.hostId,
			hostToken: room.hostToken,
			gameId: room.gameId,
		});

		onRoomCreated?.({
			roomId,
			gameId: room.gameId,
		});
	}

	function	handleHostResume(ws, data) {
		const room = rooms.get(data.roomId);

		if (
			!room ||
			room.host ||
			room.hostId !== data.hostId ||
			room.hostToken !== data.hostToken
		) {
			send(ws, {
				type: S.HOST_RESUME_REJECTED,
				roomId: data.roomId,
			});

			return;
		}

		clearTimeout(room.hostDisconnectTimer);
		room.hostDisconnectTimer = null;
		room.host = ws;

		Object.assign(ws, {
			role: "host",
			roomId: data.roomId,
			userId: room.hostId,
		});

		send(ws, {
			type: S.HOST_RESUMED,
			roomId: data.roomId,
			hostId: room.hostId,
			pendingPeers: room.pendingPeerEvents.splice(0),
		});

		for (const client of room.clients.values()) {
			send(client, {
				type: "host-resumed",
				roomId: data.roomId,
			});
		}
	}

	function	handleHostDisconnect(ws, data) {
		const room = rooms.get(data.roomId);

		if (room?.host !== ws || room.hostId !== data.hostId) {
			return;
		}

		closeRoom(data.roomId, "host-left");
	}

	function	handleClientDisconnect(ws) {
		const room = rooms.get(ws.roomId);

		if (
			!room ||
			!ws.userId ||
			room.clients.get(ws.userId) !== ws
		) {
			return;
		}

		room.clients.delete(ws.userId);

		const key = keyFor(ws.roomId, ws.userId);
		const pending = pendingDisconnects.get(key);

		if (pending) {
			clearTimeout(pending.timer);
		}

		pendingDisconnects.delete(key);

		if (room.host) {
			send(room.host, {
				type: "peer-left",
				userId: ws.userId,
			});
		}
	}

	async function	handleJoin(ws, data) {
		try {
			if (!data.token) {
				send(ws, {
					type: S.JOIN_REJECTED,
					reason: "missing-token",
				});

				return;
			}

			const claims = await verifyJoinToken(data.token);
			const room = rooms.get(claims.roomId);

			if (!room) {
				send(ws, {
					type: S.JOIN_REJECTED,
					reason: "room-not-found",
				});

				return;
			}

			if (
				authenticateJoin &&
				!(await authenticateJoin({
					claims,
					room,
					request: ws,
				}))
			) {
				send(ws, {
					type: S.JOIN_REJECTED,
					reason: "unauthorized",
				});

				return;
			}

			const userId = data.userId || uuidv4();

			const sameSocketRejoin =
				ws.role === "client" &&
				ws.roomId === claims.roomId &&
				ws.userId === userId;

			if (ws.role && !sameSocketRejoin) {
				send(ws, {
					type: S.JOIN_REJECTED,
					reason: "socket-already-joined",
				});

				return;
			}

			const key = keyFor(claims.roomId, userId);
			const pending = pendingDisconnects.get(key);
			const isReconnect = Boolean(pending) || room.clients.has(userId);

			if (pending) {
				clearTimeout(pending.timer);
			}

			pendingDisconnects.delete(key);

			if (!isReconnect && room.clients.size >= maxClients) {
				send(ws, {
					type: S.JOIN_REJECTED,
					reason: "room-full",
				});

				return;
			}

			Object.assign(ws, {
				role: "client",
				roomId: claims.roomId,
				userId,
				connectionId: uuidv4(),
			});

			room.clients.set(userId, ws);

			const event = {
				type: isReconnect ? "peer-reconnected" : "new-peer",
				userId,
				username: claims.username,
			};

			if (room.host) {
				send(room.host, event);
			} else {
				room.pendingPeerEvents.push(event);
			}

			send(ws, {
				type: S.JOIN_ACCEPTED,
				roomId: claims.roomId,
				userId,
				username: claims.username,
			});
		} catch {
			send(ws, {
				type: S.JOIN_REJECTED,
				reason: "invalid-token",
			});
		}
	}

	function	handleSignal(ws, data) {
		const room = rooms.get(ws.roomId);

		if (!room || !ws.role || !room.host) {
			return;
		}

		if (ws.role === "host" && room.host !== ws) {
			return;
		}

		if (
			ws.role === "client" &&
			room.clients.get(ws.userId) !== ws
		) {
			return;
		}

		const target = data.payload?.target;

		if (ws.role === "client" && target === "host") {
			send(room.host, {
				type: S.SIGNAL,
				payload: data.payload,
				from: ws.userId,
			});

			return;
		}

		if (ws.role === "host" && room.clients.has(target)) {
			send(room.clients.get(target), {
				type: S.SIGNAL,
				payload: data.payload,
				from: ws.userId,
			});
		}
	}

	function	handleMessage(ws, raw) {
		let data;

		try {
			data = JSON.parse(raw);
		} catch {
			send(ws, {
				type: S.ERROR,
				message: "Invalid JSON",
			});

			return;
		}

		switch (data.type) {
			case C.CREATE:
				return handleCreate(ws, data);

			case C.HOST_RESUME:
				return handleHostResume(ws, data);

			case C.HOST_DISCONNECTED:
				return handleHostDisconnect(ws, data);

			case C.CLIENT_DISCONNECTED:
				return handleClientDisconnect(ws);

			case C.JOIN:
				return handleJoin(ws, data);

			case C.SIGNAL:
				return handleSignal(ws, data);

			default:
				return send(ws, {
					type: S.ERROR,
					message: "Unknown message type",
				});
		}
	}

	function	handleConnection(ws) {
		ws.role = null;
		ws.roomId = null;

		ws.on("message", (raw) => {
			void handleMessage(ws, raw);
		});

		ws.on("close", () => {
			handleSocketClose(ws);
		});
	}

	function	handleSocketClose(ws) {
		const {
			roomId,
			role,
			userId,
		} = ws;

		const room = rooms.get(roomId);

		if (!room) {
			return;
		}

		if (role === "host" && room.host === ws) {
			handleHostSocketClose(roomId, room);
			return;
		}

		if (role === "client" && room.clients.get(userId) === ws) {
			handleClientSocketClose(roomId, userId, ws, room);
		}
	}

	function	handleHostSocketClose(roomId, room) {
		room.host = null;

		for (const client of room.clients.values()) {
			send(client, {
				type: "host-disconnected",
				roomId,
			});
		}

		room.hostDisconnectTimer = setTimeout(() => {
			closeRoom(roomId);
		}, hostReconnectGracePeriod);
	}

	function	handleClientSocketClose(roomId, userId, ws, room) {
		const key = keyFor(roomId, userId);
		const previous = pendingDisconnects.get(key);

		if (previous) {
			clearTimeout(previous.timer);
		}

		const pending = {
			timer: setTimeout(() => {
				if (
					rooms.get(roomId) !== room ||
					room.clients.get(userId) !== ws
				) {
					return;
				}

				room.clients.delete(userId);
				pendingDisconnects.delete(key);

				const event = {
					type: "peer-left",
					userId,
				};

				if (room.host) {
					send(room.host, event);
				} else {
					room.pendingPeerEvents.push(event);
				}
			}, reconnectGracePeriod),
		};

		pendingDisconnects.set(key, pending);

		const event = {
			type: "peer-disconnected",
			userId,
		};

		if (room.host) {
			send(room.host, event);
		} else {
			room.pendingPeerEvents.push(event);
		}
	}

	wss.on("connection", handleConnection);

	const app = express();

	app.use(cors(corsOptions));
	app.use(express.json());

	app.get("/health", (_req, res) => {
		res.json({
			status: "ok",
			uptime: process.uptime(),
		});
	});

	app.get("/stats", (_req, res) => {
		const totalClients = [...rooms.values()].reduce(
			(sum, room) => sum + room.clients.size,
			0,
		);

		res.json({
			totalRooms: rooms.size,
			totalClients,
		});
	});

	app.get("/games", (_req, res) => {
		res.json({ games });
	});

	app.get("/rooms/:roomId", (req, res) => {
		const room = rooms.get(req.params.roomId);

		if (!room) {
			res.status(404).json({
				error: "Room not found",
			});

			return;
		}

		res.json({
			roomId: req.params.roomId,
			clientCount: room.clients.size,
			maxClients,
			gameUrl: games[room.gameId] || null,
		});
	});

	app.post("/token", async (req, res) => {
		const {
			roomId,
			username,
			account,
		} = req.body || {};

		if (!roomId || !username) {
			res.status(400).json({
				error: "roomId and username required",
			});

			return;
		}

		if (username.length > 16) {
			res.status(400).json({
				error: "Username too long",
			});

			return;
		}

		const room = rooms.get(roomId);

		if (!room) {
			res.status(404).json({
				error: "Room not found",
			});

			return;
		}

		try {
			const token = await issueJoinToken({
				roomId,
				username,
				account,
				gameId: room.gameId,
			});

			res.json({
				token,
				gameUrl: games[room.gameId] || null,
			});
		} catch (error) {
			res.status(401).json({
				error: error.message || "Could not authorize join",
			});
		}
	});

	const apiServer = app.listen(apiPort);

	return {
		rooms,
		wss,
		app,
		apiServer,

		close() {
			for (const roomId of rooms.keys()) {
				closeRoom(roomId, "server-shutdown");
			}

			return Promise.all([
				new Promise((resolve) => wss.close(resolve)),
				new Promise((resolve, reject) => {
					apiServer.close((error) => {
						if (error) {
							reject(error);
							return;
						}

						resolve();
					});
				}),
			]);
		},
	};
}

module.exports = {
	createSignalingServer,
	generateRoomId,
};