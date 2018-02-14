"use strict";

var http = require("http");
var express = require("express");
var app = express();

const WebSocket = require("ws");

var interval;
const config = require("./config.json");

app.use("/", express.static(__dirname + "/public_html"));

var server = http.Server(app);

const wss = new WebSocket.Server({
  server: server,
  perMessageDeflate: true
});

server.listen(config.port, function() {
  console.log("Server is listening on 127.0.0.1:" + config.port);
});

var colors = [0, 1, 2, 3, 4, 5, 6];

var counter = 1;

var food = [];

var size = {
  height: 600,
  width: 720
};

function addFood() {
  if (food.length >= 24) {
    return;
  }

  var x = randomNumber(1, size.width / 10 - 2);
  var y = randomNumber(1, size.height / 10 - 2);

  var found = false;

  for (var i = 0; i < food.length; i++) {
    if (food[i].x === x && food[i].y === y) {
      found = true;
      break;
    }
  }

  wss.clients.forEach(function(socket) {
    if (!socket.data.snake) return;
    socket.data.snake.forEach(function(position) {
      if (position.x === x && position.y === y) {
        found = true;
      }
    });
  });

  if (found) {
    addFood();
  } else {
    eat = true;
    food.push({
      x: x,
      y: y
    });
  }
}

addFood();

wss.on("close", function(ws) {});

wss.on("error", function(error) {
  console.log(error);
});

wss.on("connection", function connection(ws) {
  ws.on("error", function() {});

  ws.data = {
    id: counter++,
    color: colors.shift(),
    frame: 0
  };

  spawn(ws);

  ws.on("close", function() {
    colors.push(ws.data.color);
  });

  ws.on("message", function incoming(message) {
    try {
      var data = JSON.parse(message);
    } catch (error) {
      return;
    }

    switch (data.type) {
      case "direction":
        ws.data.direction = data.direction;

        break;

      case "latency":
        if (ws.readyState === WebSocket.OPEN) {
          ws.send(
            JSON.stringify({
              t: 1,
              d: data.time
            })
          );
        }

        break;

      case 70:
        addFood();
        break;

      case "boost":
        if (ws.data.snake.length > 3) {
          ws.data.snake.splice(0, 1);
          tick(ws);
        }

        break;
    }
  });
});

interval = setInterval(tick, 1000 / config.tick);

var eat = false;

function tick(ws) {
  var buffer = [];

  wss.clients.forEach(function(client) {
    if (ws && ws.data.id !== client.data.id) {
      buffer.push(client.data);
      return;
    }

    var last = client.data.snake[client.data.snake.length - 1];

    switch (client.data.direction) {
      case "right":
        if (client.data.last_direction === "left") {
          client.data.direction = client.data.last_direction;

          client.data.snake.push({
            x: last.x - 1,
            y: last.y
          });
        } else {
          client.data.snake.push({
            x: last.x + 1,
            y: last.y
          });
        }

        break;

      case "down":
        if (client.data.last_direction === "up") {
          client.data.direction = client.data.last_direction;

          client.data.snake.push({
            x: last.x,
            y: last.y - 1
          });
        } else {
          client.data.snake.push({
            x: last.x,
            y: last.y + 1
          });
        }

        break;

      case "up":
        if (client.data.last_direction === "down") {
          client.data.direction = client.data.last_direction;

          client.data.snake.push({
            x: last.x,
            y: last.y + 1
          });
        } else {
          client.data.snake.push({
            x: last.x,
            y: last.y - 1
          });
        }

        break;

      case "left":
        if (client.data.last_direction === "right") {
          client.data.direction = client.data.last_direction;

          client.data.snake.push({
            x: last.x + 1,
            y: last.y
          });
        } else {
          client.data.snake.push({
            x: last.x - 1,
            y: last.y
          });
        }

        break;
    }

    last = client.data.snake[client.data.snake.length - 1];

    var restore = false;

    if (!restore) {
      client.data.snake
        .slice(0, client.data.snake.length - 2)
        .forEach(function(item) {
          if (item.x === last.x && item.y === last.y) {
            restore = true;
          }
        });
    }

    if (!restore) {
      if (size.width / 10 - 1 === last.x || size.height / 10 - 1 === last.y) {
        restore = true;
      } else if (last.x === 0 || last.y === 0) {
        restore = true;
      }
    }

    if (restore) {
      spawn(client);
    } else {
      client.data.last_direction = client.data.direction;

      var remove = false;
      var tmp = [];

      food.forEach(function(item, index) {
        if (item.x === last.x && item.y === last.y) {
          remove = true;
          tmp.push(index);
        }
      });

      for (var i = tmp.length - 1; i > -1; i--) {
        food.splice(tmp[i], 1);
        eat = true;
      }

      if (!remove) {
        client.data.snake.splice(0, 1);
      } else {
        if (food.length === 0) {
          addFood();
        }
        client.data.score++;
      }
    }

    if (typeof client.data.color === "object") {
      if (client.data.color.array.length - 1 === client.data.color.current) {
        client.data.color.current = 0;
      } else {
        client.data.color.current++;
      }
    }

    buffer.push(client.data);
  });

  var collision = [];

  wss.clients.forEach(function(client) {
    var client_last = client.data.snake[client.data.snake.length - 1];

    wss.clients.forEach(function(another_client) {
      if (client.data.id !== another_client.data.id) {
        for (var i = 0; i < another_client.data.snake.length; i++) {
          if (
            another_client.data.snake[i].x === client_last.x &&
            another_client.data.snake[i].y === client_last.y
          ) {
            collision.push(client);
            break;
          }
        }
      }
    });
  });

  collision.forEach(function(item) {
    spawn(item);
  });

  var compressed = [];

  buffer.forEach(function(client) {
    var tmp = {
      x: [],
      y: [],
      d: client.last_direction ? client.last_direction : client.direction,
      i: client.id
    };

    for (var b = 0; b < client.snake.length; b++) {
      tmp.x.push(client.snake[b].x);
      tmp.y.push(client.snake[b].y);
    }

    tmp.c = client.color;

    compressed.push(tmp);
  });

  var compressed_food = {
    x: [],
    y: []
  };

  food.forEach(function(position) {
    compressed_food.x.push(position.x);
    compressed_food.y.push(position.y);
  });

  wss.clients.forEach(function(client) {
    if (client.readyState === WebSocket.OPEN) {
      client.send(
        JSON.stringify({
          t: 0,
          s: compressed,
          f: eat ? compressed_food : client.data.frame++ ? 0 : compressed_food,
          o: client.data.score,
          r: config.tick
        })
      );
    } else {
      client.terminate();
    }
  });

  eat = false;
}

function spawn(client) {
  var coordinates = [];

  wss.clients.forEach(function(socket) {
    if (!socket.data.snake) return;
    socket.data.snake.forEach(function(position) {
      coordinates.push({
        x: position.x,
        y: position.y
      });
    });
  });

  var coordinate = randomNumber(10, size.width / 10 - 15);

  var tmp = [
    {
      x: coordinate,
      y: coordinate
    }
  ];

  for (var i = 0; i < config.default_snake_length; i++) {
    tmp.push({
      x: coordinate + i,
      y: coordinate
    });
  }

  var collision = false;

  coordinates.forEach(function(coordinate) {
    tmp.forEach(function(position) {
      if (position.x === coordinate.x && position.y === coordinate.y) {
        collision = true;
      }
    });
  });

  if (collision) {
    spawn(client);
    return;
  }

  client.data.snake = tmp;

  client.data.direction = "right";
  client.data.last_direction = client.data.direction;
  client.data.score = 0;
}

function randomDirection() {
  switch (randomNumber(0, 3)) {
    case 0:
      return "up";
      break;
    case 1:
      return "right";
      break;
    case 2:
      return "down";
      break;
    case 3:
      return "left";
      break;
  }
}

setInterval(function() {
  if (2 > food.length) {
    addFood();
  }
}, 1000 * 30);

function heartbeat() {
  this.isAlive = true;
}

wss.on("connection", function connection(ws) {
  ws.isAlive = true;
  ws.on("pong", heartbeat);
});

const aliveInterval = setInterval(function ping() {
  wss.clients.forEach(function each(ws) {
    if (ws.isAlive === false) return ws.terminate();

    ws.isAlive = false;
    ws.ping();
  });
}, 1000 * 10);

function randomNumber(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}
