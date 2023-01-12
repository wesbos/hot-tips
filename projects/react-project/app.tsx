import React, { useState } from 'https://esm.sh/react@18.2.0';
import { render } from 'https://esm.sh/react-dom@18.2.0';

function App() {
  const [count, setCount] = useState(0);
  return (
    <button onClick={() => setCount(count + 1)}>{count}</button>
  );
}

render(<App />, document.getElementById(`app`));

