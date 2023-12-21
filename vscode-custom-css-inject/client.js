const websocket = new WebSocket(`ws://localhost:5786`);

websocket.onmessage = (message) => {
  const data = JSON.parse(message.data);
  if (data.type === `css`) {
    document.querySelector(`style#${data.id}`).innerHTML = data.css;
  }
  console.log(`Received:`, data);
};

websocket.onclose = () => {
  console.log(`Disconnected`);
};

websocket.onerror = (error) => {
  console.log(`Error: ${error}`);
};
