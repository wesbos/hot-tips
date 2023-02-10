import React from 'react';

export default function Home(props) {
  console.log(`props`, props);
  return (
    <div>
      <h1>{props.title}</h1>
      <p>{props.message}</p>
      <CourseCard courseCode={props.courseCode} productCode={props.productCode} />
    </div>
  );
}

function CourseCard({ courseCode, productCode }) {
  return (
    <div>
      <p>{courseCode}</p>
      <p>{productCode}</p>
    </div>
  );
}
