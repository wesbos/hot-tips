export class PathMe {
  moves: string[] = [];

  constructor() {
    this.moves = [];
    return this;
  }

  moveTo(x: number, y: number) {
    this.moves.push(`M ${x} ${y}`);
    return this;
  }

  closePath() {
    this.moves.push('Z');
    return this;
  }

  lineTo(x: number, y: number) {
    this.moves.push(`L ${x} ${y}`);
    return this;
  }

  horizontalLineTo(x: number) {
    this.moves.push(`H ${x}`);
    return this;
  }

  verticalLineTo(y: number) {
    this.moves.push(`V ${y}`);
    return this;
  }

  curveTo(x1: number, y1: number, x2: number, y2: number, x: number, y: number) {
    this.moves.push(`C ${x1} ${y1} ${x2} ${y2} ${x} ${y}`);
    return this;
  }

  smoothCurveTo(x2: number, y2: number, x: number, y: number) {
    this.moves.push(`S ${x2} ${y2} ${x} ${y}`);
    return this;
  }

  quadraticCurveTo(x1: number, y1: number, x: number, y: number) {
    this.moves.push(`Q ${x1} ${y1} ${x} ${y}`);
    return this;
  }

  smoothQuadraticCurveTo(x: number, y: number) {
    this.moves.push(`T ${x} ${y}`);
    return this;
  }

  arc(rx: number, ry: number, xAxisRotation: number, largeArcFlag: boolean, sweepFlag: boolean, x: number, y: number) {
    const largeArc = largeArcFlag ? 1 : 0;
    const sweep = sweepFlag ? 1 : 0;
    this.moves.push(`A ${rx} ${ry} ${xAxisRotation} ${largeArc} ${sweep} ${x} ${y}`);
    return this;
  }

  catmullRomCurveTo(x1: number, y1: number, x: number, y: number) {
    this.moves.push(`R ${x1} ${y1} ${x} ${y}`);
    return this;
  }

  toString() {
    return this.moves.join(' ');
  }
}
