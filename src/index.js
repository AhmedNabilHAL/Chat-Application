const path = require("path");
const http = require("http");
const express = require("express");
const socketio = require("socket.io");
const Filter = require("bad-words");
const { generateMessage, generateLocationMessage } = require("./utils/messages");
const { addUser, removeUser, getUser, getUsersInRoom } = require("./utils/users")

const app = express();
const server = http.createServer(app);
const io = socketio(server);

const publicDirectoryPath = path.join(__dirname, "../public");

app.use(express.json());

app.use(express.static(publicDirectoryPath));

let count = 0;

io.on("connection", (socket) => {
    console.log("New websocket connection.");

    socket.on("join", ({ username, room }, callback) => {
        const {error, user } = addUser({ id: socket.id, username, room });
        if (error) {
            return callback(error);
        }

        socket.join(user.room);

        socket.emit("message", generateMessage("Welcome"));
        socket.broadcast.to(user.room).emit("message", generateMessage(`${user.username} has joined!`));
        io.to(user.room).emit("roomData", {
            room: user.room,
            users: getUsersInRoom(user.room)
        })

        callback();
    })

    socket.on("sendMessage", (msg, callback) => {
        const user = getUser(socket.id);

        if (!user) return callback("can't send!");

        const filter = new Filter();
        if (filter.isProfane(msg)) return callback("profanity is not allowed");

        if (!msg || !msg.replace(/\s/g, '').length) return callback("Empty message");

        io.to(user.room).emit("message", generateMessage(msg, user.username));
        callback();
    })

    socket.on("disconnect", () => {
        const user = removeUser(socket.id);
        
        if (user) {
            io.to(user.room).emit("message", generateMessage(`${user.username} has left!`))
            io.to(user.room).emit("roomData", {
                room: user.room,
                users: getUsersInRoom(user.room)
            })
        }

    });

    socket.on("sendlocation", ({latitude, longitude}, callback) => {
        const user = getUser(socket.id);

        if (!user) return callback("can't send!");

        io.to(user.room).emit("locationMessage", generateLocationMessage(`https://www.google.com/maps?q=${latitude},${longitude}`, user.username));
        callback("Location Shared!");
    })
})



const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
    console.log("Server is up on port " + PORT);
});