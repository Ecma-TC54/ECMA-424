export class SectionNumber {
  constructor() {
    this.sectionNumbers = [];
  }

  get positions() {
    return this.sectionNumbers.length;
  }

  position(index) {
    return this.sectionNumbers[index];
  }

  incrementCounter(count) {
    // Simplified: Just ensure we have enough levels in the array
    while (this.sectionNumbers.length < count) {
      this.sectionNumbers.push(0);
    }
    // Actual numbers are no longer needed, but we still need to track depth
    // Just maintain the array length for proper nesting
  }

  incrementPosition(position) {
    // Simplified: Just ensure we have enough levels in the array
    while (this.sectionNumbers.length < position) {
      this.sectionNumbers.push(0);
    }
    // Trim the array to the current position to ensure proper nesting
    this.sectionNumbers = this.sectionNumbers.slice(0, position);
  }

  get label() {
    // Actual numbers are no longer needed
    // Return an empty string as section numbers are not displayed
    return "";
  }
}
