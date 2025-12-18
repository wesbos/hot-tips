/* eslint-disable*/
const decoder = new TextDecoder();

// fetch('https://api.github.com/users/wesbos')
//   .then(res => res.json())
//   .then(data => console.log(data));

// AbortController
const controller = new AbortController();
fetch(`http://localhost:8000/`, { signal: controller.signal })
  .then(async (res) => {
    const reader = res.body.getReader();
    let chunks = [];
    while (true) {
      const { done, value } = await reader.read();
      const text = decoder.decode(value);
      chunks.push(text);
      console.log('🫴:', text);
      if (done) {
        break;
      }
    }
    return chunks.join("");
  }).then((data) => {
    console.log('Done, here is everything!');
    console.log(data)
  })
