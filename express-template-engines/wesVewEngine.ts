import fs from 'fs';

export function wesViewEngine(filePath, options, callback) {
  // define the template engine
  fs.readFile(filePath, (err, content) => {
    if (err) return callback(err);
    // this is an extremely simple template engine
    const rendered = content.toString().replace('#title#', options.title).replace('#message#', options.message);
    return callback(null, rendered);
  });
}
