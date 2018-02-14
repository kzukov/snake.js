(function() {
  var elements = [
    "canvas",
    "score",
    "latency",
    "bytes_received",
    "bytes_sent",
    "tick_rate",
    "food_counter",
    "fps_counter",
    "debug_toggle",
    "debug_inner"
  ].forEach(element => {
    this[element] = document.getElementById(element);
  });

  var ctx = canvas.getContext("2d");

  debug_toggle.addEventListener("click", function() {
    if (debug_inner.style.display == "none") {
      debug_inner.style.display = "block";
    } else {
      debug_inner.style.display = "none";
    }
  });

  var socket = new WebSocket(
    "ws://" +
      (location.hostname == "localhost"
        ? location.hostname
        : "159.89.104.149") +
      ":" +
      location.port || 80
  );

  var time;

  var food = {
    x: [],
    y: []
  };

  var session = {
    id: null,
    score: 0
  };

  var config = {
    food_form: "square",
    animation: true
  };

  var snakes = [];

  var parts = {};

  const colors = {
    0: "yellow",
    1: "cyan",
    2: "orange",
    3: "lightblue",
    4: "magenta",
    5: "lime",
    6: "red"
  };

  var traffic = {
    received: 0,
    sent: 0
  };

  const size = {
    height: 600,
    width: 720,
    step: 10
  };

  function send(data) {
    var string = JSON.stringify(data);
    traffic.sent += new TextEncoder("utf-8").encode(string).length;
    socket.send(string);
  }

  socket.onopen = function() {
    console.log("Connection established");

    time = Date.now();

    send({
      type: "latency",
      time: time
    });
  };

  socket.onclose = function(event) {
    if (event.wasClean) {
      console.log("The connection is closed cleanly");
    } else {
      console.log("Connection failure");
    }
    console.log("Code: " + event.code + " reason: " + event.reason);
  };

  setInterval(function() {
    bytes_received.innerHTML = bytesToSize(traffic.received);
    bytes_sent.innerHTML = bytesToSize(traffic.sent);
  }, 1000 * 1);

  socket.onmessage = function(event) {
    traffic.received += new TextEncoder("utf-8").encode(event.data).length;

    var object = JSON.parse(event.data);

    switch (object.t) {
      case 0:
        if (object.f) {
          food = object.f;
        }

        snakes = object.s;

        if (!config.animation) {
          window.requestAnimationFrame(draw);
        }

        if (session.score !== object.o) {
          session.score = object.o;
          score.innerHTML = session.score;
        }

        tick_rate.innerHTML = object.r;
        food_counter.innerHTML = food.x.length;

        break;

      case 1:
        var latencyTime = Date.now() - object.d;

        latency.innerHTML = latencyTime;

        setTimeout(function() {
          time = Date.now();
          send({
            type: "latency",
            time: time
          });
        }, 1000);

        break;
    }
  };

  socket.onerror = function(error) {
    console.log("An error " + error.message);
  };

  function border() {
    ctx.fillStyle = "white";
    for (var i = 0; i < size.width / size.step; i++) {
      ctx.fillRect(size.step * i, 0 * size.step, size.step, size.step);
      ctx.fillRect(
        size.step * i,
        size.height - 1 * size.step,
        size.step,
        size.step
      );
    }
    for (var i = 0; i < size.height / size.step; i++) {
      ctx.fillRect(0, size.step * i, size.step, size.step);
      ctx.fillRect(
        size.width - 1 * size.step,
        i * size.step,
        size.step,
        size.step
      );
    }
  }

  function grid() {
    var fill = false;

    for (var a = 0; a < size.height; a++) {
      if (fill) {
        fill = false;
      } else {
        fill = true;
      }
      for (var i = 0; i < size.width / size.step; i++) {
        if (fill) {
          ctx.fillStyle = "black";
          ctx.fillRect(size.step * i, a * size.step, size.step, size.step);
          fill = false;
        } else {
          ctx.fillStyle = "#111";
          ctx.fillRect(size.step * i, a * size.step, size.step, size.step);
          fill = true;
        }
      }
    }
  }

  var then = 0;
  var fps = 0;

  function draw(now) {
    now *= 0.001;
    var delta = now - then;
    then = now;
    var new_fps = parseInt(1 / delta);

    ctx.fillStyle = "black";
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    ctx.fillStyle = "#eee";

    for (var i = 0; i < food.x.length; i++) {
      switch (config.food_form) {
        case "square":
          ctx.fillRect(
            size.step * food.x[i],
            size.step * food.y[i],
            size.step,
            size.step
          );

          break;

        case "circle":
          ctx.beginPath();
          ctx.arc(
            size.step * food.x[i] + size.step / 2,
            size.step * food.y[i] + size.step / 2,
            size.step / 2 - 1,
            0,
            Math.PI * 2,
            true
          );
          ctx.closePath();
          ctx.fill();

          break;
      }
    }

    snakes.forEach(function(client) {
      var color = client.c;

      if (typeof color === "object") {
        color = color.array[color.current];
      }

      ctx.fillStyle = colors[color];

      var length = client.x.length - 1;

      var last = {
        x: client.x[length],
        y: client.y[length]
      };

      for (var i = 0; i < client.x.length; i++) {
        if (!config.animation) {
          ctx.fillRect(
            size.step * client.x[i],
            size.step * client.y[i],
            size.step,
            size.step
          );
        } else {
          if (i != length) {
            if (i !== 0) {
              ctx.fillRect(
                size.step * client.x[i],
                size.step * client.y[i],
                size.step,
                size.step
              );
            }
          }
        }
      }

      if (!config.animation) return;

      if (!parts[client.i]) {
        parts[client.i] = {
          _last: {
            x: last.x,
            y: last.y,
            progress: 0,
            direction: client.d
          },
          _first: {
            x: client.x[0],
            y: client.y[0],
            animate: false
          }
        };
      } else {
        if (parseInt(parts[client.i]._last.progress) == size.step) {
          ctx.fillRect(
            size.step * parts[client.i]._last.x,
            size.step * parts[client.i]._last.y,
            size.step,
            size.step
          );
        }

        if (
          parts[client.i]._last.x !== last.x ||
          parts[client.i]._last.y !== last.y
        ) {
          parts[client.i]._last = {
            x: last.x,
            y: last.y,
            progress: 0,
            direction: client.d
          };
        }

        if (
          parts[client.i]._first.x !== client.x[0] ||
          parts[client.i]._first.y !== client.y[0]
        ) {
          parts[client.i]._first.progress = 0;
          parts[client.i]._first.animate = true;

          parts[client.i]._first.direction = findDirection(
            {
              x: parts[client.i]._first.x,
              y: parts[client.i]._first.y
            },
            {
              x: client.x[0],
              y: client.y[0]
            }
          );

          parts[client.i]._first.x = client.x[0];
          parts[client.i]._first.y = client.y[0];

          var tmp_direction = findDirection(
            {
              x: parts[client.i]._first.x,
              y: parts[client.i]._first.y
            },
            {
              x: client.x[1],
              y: client.y[1]
            }
          );

          if (parts[client.i]._first.direction != tmp_direction) {
            parts[client.i]._first.direction = tmp_direction;
          }
        }
      }

      if (parts[client.i]._first.progress !== size.step) {
        parts[client.i]._first.progress += 2;

        if (parts[client.i]._first.animate) {
          switch (parts[client.i]._first.direction) {
            case "right":
              ctx.fillRect(
                size.step * parts[client.i]._first.x +
                  parts[client.i]._first.progress,
                size.step * parts[client.i]._first.y,
                size.step,
                size.step
              );
              break;

            case "up":
              ctx.fillRect(
                size.step * parts[client.i]._first.x,
                size.step * parts[client.i]._first.y,
                size.step,
                size.step - parts[client.i]._first.progress
              );

              break;

            case "down":
              ctx.fillRect(
                size.step * parts[client.i]._first.x,
                size.step * parts[client.i]._first.y +
                  parts[client.i]._first.progress,
                size.step,
                size.step
              );

              break;

            case "left":
              ctx.fillRect(
                size.step * parts[client.i]._first.x,
                size.step * parts[client.i]._first.y,
                size.step - parts[client.i]._first.progress,
                size.step
              );

              break;
          }
        }
      } else {
        parts[client.i]._first.x = client.x[0];
        parts[client.i]._first.y = client.y[0];
      }

      if (parts[client.i]._last.progress !== size.step) {
        parts[client.i]._last.progress += 2;

        switch (parts[client.i]._last.direction) {
          case "right":
            ctx.fillRect(
              size.step * parts[client.i]._last.x,
              size.step * parts[client.i]._last.y,
              parts[client.i]._last.progress,
              size.step
            );

            break;

          case "down":
            ctx.fillRect(
              size.step * parts[client.i]._last.x,
              size.step * parts[client.i]._last.y,
              size.step,
              parts[client.i]._last.progress
            );

            break;

          case "up":
            ctx.fillRect(
              size.step * parts[client.i]._last.x,
              size.step * parts[client.i]._last.y +
                size.step -
                Math.abs(parts[client.i]._last.progress),
              size.step,
              size.step
            );

            break;

          case "left":
            ctx.fillRect(
              size.step * parts[client.i]._last.x +
                size.step -
                Math.abs(parts[client.i]._last.progress),
              size.step * parts[client.i]._last.y,
              size.step,
              size.step
            );

            break;
        }
      }

      ctx.shadowBlur = 0;
    });

    border();

    if (config.animation) {
      window.requestAnimationFrame(draw);
    }

    if (new_fps !== fps) {
      fps = new_fps;
      fps_counter.innerHTML = new_fps;
    }
  }

  window.requestAnimationFrame(draw);

  document.addEventListener("keydown", function(event) {
    switch (event.keyCode) {
      case 37:
      case 65:
        send({
          type: "direction",
          direction: "left"
        });
        break;
      case 38:
      case 87:
        send({
          type: "direction",
          direction: "up"
        });
        break;
      case 39:
      case 68:
        send({
          type: "direction",
          direction: "right"
        });
        break;
      case 40:
      case 83:
        send({
          type: "direction",
          direction: "down"
        });
        break;

      case 86: // v
        if (config.animation) {
          config.animation = false;
        } else {
          config.animation = true;
          window.requestAnimationFrame(draw);
        }

        break;
    }
  });

  var boost;

  function findDirection(first, second) {
    if (first.x === second.x) {
      if (first.y + 1 === second.y) {
        return "down";
      } else {
        return "up";
      }
    } else if (first.y === second.y) {
      if (first.x + 1 === second.x) {
        return "right";
      } else {
        return "left";
      }
    }
  }

  onkeydown = onkeyup = function(e) {
    if (e.keyCode === 32) {
      switch (e.type) {
        case "keydown":
          if (!boost) {
            boost = setInterval(function() {
              send({
                type: "boost"
              });
            }, 1000 / 12);
          }

          break;

        case "keyup":
          clearInterval(boost);
          boost = null;

          break;
      }
    }
  };

  function bytesToSize(bytes) {
    var sizes = ["Bytes", "KB", "MB", "GB", "TB"];
    if (bytes === 0) return "0 Byte";
    var i = parseInt(Math.floor(Math.log(bytes) / Math.log(1024)));
    return Math.round(bytes / Math.pow(1024, i), 2) + " " + sizes[i];
  }
})();
