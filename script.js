if (!location.hash) {
  location.hash = Math.floor(Math.random() * 0xffffff).toString(16);
}

const roomHash = location.hash.substring(1);

const drone = new ScaleDrone("D7dCriyY4Xi2aMae");
const roomName = "observable-" + roomHash;

const configuration = {
  iceServers: [
    {
      urls: "stun:stun.l.google.com:19302",
    },
  ],
};

let room;
let pc;
let numbers = 0;

function onSuccess() {
  console.log("Sucesso");
}

function onError(err) {
  console.log(err);
}

drone.on("open", (error) => {
  if (error) {
    return console.error(error);
  }

  room = drone.subscribe(roomName);

  room.on("open", (error) => {
    if (error) {
      onError(error);
    }
  });

  room.on("members", (members) => {
    numbers = members.length - 1;
    const isOfferer = numbers >= 2;
    startWebRTC(isOfferer);
  });
});

function sendMessage(message) {
  drone.publish({
    room: roomName,
    message,
  });
}

function startWebRTC(isOfferer) {
  pc = new RTCPeerConnection(configuration);

  pc.onicecandidate = (event) => {
    if (event.candidate) {
      sendMessage({ candidate: event.candidate });
    }
  };

  if (isOfferer) {
    pc.createOffer().then(localDescCreated).catch(onError);
  }

  pc.ontrack = (event) => {
    const stream = event.streams[0];
    if (!remoteVideo.srcObject || remoteVideo.srcObject.id !== stream.id) {
      remoteVideo.srcObject = stream;
    }
  };

  navigator.mediaDevices
    .getUserMedia({
      video: true,
      audio: true,
    })
    .then((stream) => {
      localVideo.srcObject = stream;
      stream.getTracks().forEach((track) => pc.addTrack(track, stream));
    }, onError);

  room.on("member_leave", (member) => {
    remoteVideo.style.display = "none";
  });

  room.on("data", (message, client) => {
    if (client.id === drone.clientId) {
      return;
    }

    if (message.sdp) {
      pc.setRemoteDescription(new RTCSessionDescription(message.sdp), () => {
        if (pc.remoteDescription.type === "offer") {
          pc.createAnswer().then(localDescCreated).catch(onError);
        }
      });
    } else if (message.candidate) {
      pc.addIceCandidate(
        new RTCIceCandidate(message.candidate),
        onSuccess,
        onError
      );
    }
  });
}

function localDescCreated(desc) {
  pc.setLocalDescription(
    desc,
    () => sendMessage({ sdp: pc.localDescription }),
    onError
  );
}
