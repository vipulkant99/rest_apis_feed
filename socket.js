let io;

module.exports = {
  init: (httpServer) => {
    io = require("socket.io")(httpServer, {
      cors: {
        origin: "http://localhost:3000", // React dev server
      },
    });
    return io;
  },
  getIO: () => {
    if(!io){
        throw new Error('Socket.io not initialised');
    }
    return io;
  }
};
