const { format } =
  new Intl.NumberFormat('en-FR',
  {
    style: 'currency',
    currency: 'CAD',
  });


format(200.23); //?
format(200.99);
format(777);
format(0.01);
format(42069);










format(205.23);
