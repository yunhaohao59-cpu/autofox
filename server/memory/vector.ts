export class VectorStore {
  private dim = 256;

  embed(text: string): Float64Array {
    const trigrams = this.extractTrigrams(text.toLowerCase());
    const vec = new Float64Array(this.dim);
    for (const trigram of trigrams) {
      let hash = 0;
      for (let i = 0; i < trigram.length; i++) {
        hash = ((hash << 5) - hash + trigram.charCodeAt(i)) | 0;
      }
      const idx = Math.abs(hash) % this.dim;
      vec[idx]! += 1;
    }
    const norm = Math.sqrt(vec.reduce((s, v) => s + v * v, 0));
    if (norm > 0) {
      for (let i = 0; i < this.dim; i++) {
        vec[i] = vec[i]! / norm;
      }
    }
    return vec;
  }

  similarity(a: Float64Array | number[], b: Float64Array | number[]): number {
    let dot = 0;
    for (let i = 0; i < this.dim; i++) {
      dot += (a[i] ?? 0) * (b[i] ?? 0);
    }
    return dot;
  }

  private extractTrigrams(text: string): string[] {
    const trigrams: string[] = [];
    for (let i = 0; i < text.length - 2; i++) {
      trigrams.push(text.slice(i, i + 3));
    }
    return trigrams;
  }
}
