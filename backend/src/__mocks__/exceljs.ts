type CellState = {
  value: unknown;
  numFmt?: string;
  alignment?: Record<string, unknown>;
  border?: Record<string, unknown>;
  font?: Record<string, unknown>;
};

const cloneCellState = (cell: CellState): CellState => ({
  value: cell.value,
  numFmt: cell.numFmt,
  alignment: cell.alignment ? { ...cell.alignment } : undefined,
  border: cell.border ? { ...cell.border } : undefined,
  font: cell.font ? { ...cell.font } : undefined,
});

class MockCell {
  private state: CellState;

  constructor(state: CellState) {
    this.state = state;
  }

  get value(): unknown {
    return this.state.value;
  }

  set value(nextValue: unknown) {
    this.state.value = nextValue;
  }

  get numFmt(): string | undefined {
    return this.state.numFmt;
  }

  set numFmt(nextValue: string | undefined) {
    this.state.numFmt = nextValue;
  }

  get alignment(): Record<string, unknown> | undefined {
    return this.state.alignment;
  }

  set alignment(nextValue: Record<string, unknown> | undefined) {
    this.state.alignment = nextValue;
  }

  get border(): Record<string, unknown> | undefined {
    return this.state.border;
  }

  set border(nextValue: Record<string, unknown> | undefined) {
    this.state.border = nextValue;
  }

  get font(): Record<string, unknown> | undefined {
    return this.state.font;
  }

  set font(nextValue: Record<string, unknown> | undefined) {
    this.state.font = nextValue;
  }
}

class MockRow {
  private worksheet: MockWorksheet;
  public readonly index: number;
  public font?: Record<string, unknown>;
  public alignment?: Record<string, unknown>;

  constructor(worksheet: MockWorksheet, index: number) {
    this.worksheet = worksheet;
    this.index = index;
  }

  get values(): unknown[] {
    const cells = this.worksheet.getCellsForRow(this.index);
    const maxIndex = Math.max(0, ...cells.map(([cellIndex]) => cellIndex));
    const values = new Array(maxIndex + 1).fill(undefined);
    for (const [cellIndex, state] of cells) {
      values[cellIndex] = state.value;
    }
    return values;
  }

  set values(nextValues: unknown[]) {
    nextValues.forEach((value, cellIndex) => {
      if (cellIndex === 0) return;
      this.getCell(cellIndex).value = value;
    });
  }

  getCell(index: number): MockCell {
    return this.worksheet.getCellByIndex(this.index, index);
  }

  eachCell(
    optionsOrCallback:
      | { includeEmpty?: boolean }
      | ((cell: MockCell, colNumber: number) => void),
    maybeCallback?: (cell: MockCell, colNumber: number) => void,
  ): void {
    const callback =
      typeof optionsOrCallback === "function"
        ? optionsOrCallback
        : maybeCallback;
    if (!callback) return;

    for (const [cellIndex, state] of this.worksheet.getCellsForRow(this.index)) {
      callback(new MockCell(state), cellIndex);
    }
  }
}

class MockWorksheet {
  private cells = new Map<number, Map<number, CellState>>();
  public readonly name: string;
  public columns: Array<Record<string, unknown>> = [];
  public pageSetup: Record<string, unknown> = {};
  private mergedRanges: string[] = [];

  constructor(name: string) {
    this.name = name;
  }

  private ensureCell(rowIndex: number, cellIndex: number): CellState {
    let row = this.cells.get(rowIndex);
    if (!row) {
      row = new Map();
      this.cells.set(rowIndex, row);
    }

    let cell = row.get(cellIndex);
    if (!cell) {
      cell = { value: undefined };
      row.set(cellIndex, cell);
    }

    return cell;
  }

  getCellsForRow(rowIndex: number): Array<[number, CellState]> {
    const row = this.cells.get(rowIndex);
    if (!row) return [];
    return Array.from(row.entries()).sort(([a], [b]) => a - b);
  }

  getRow(index: number): MockRow {
    return new MockRow(this, index);
  }

  getCell(addr: string): MockCell {
    const match = addr.match(/^([A-Z]+)(\d+)$/i);
    if (!match) throw new Error(`Invalid cell address: ${addr}`);
    const col = MockWorksheet.columnLettersToNumber(match[1]);
    const row = Number.parseInt(match[2], 10);
    return this.getCellByIndex(row, col);
  }

  getCellByIndex(rowIndex: number, cellIndex: number): MockCell {
    return new MockCell(this.ensureCell(rowIndex, cellIndex));
  }

  mergeCells(range: string): void {
    this.mergedRanges.push(range);
  }

  get rowCount(): number {
    const rows = Array.from(this.cells.keys());
    return rows.length ? Math.max(...rows) : 0;
  }

  serialize() {
    return {
      name: this.name,
      columns: this.columns,
      pageSetup: this.pageSetup,
      mergedRanges: this.mergedRanges,
      cells: Array.from(this.cells.entries()).map(([rowIndex, row]) => [
        rowIndex,
        Array.from(row.entries()).map(([cellIndex, state]) => [
          cellIndex,
          cloneCellState(state),
        ]),
      ]),
    };
  }

  static deserialize(payload: ReturnType<MockWorksheet["serialize"]>): MockWorksheet {
    const worksheet = new MockWorksheet(payload.name);
    worksheet.columns = payload.columns as Array<Record<string, unknown>>;
    worksheet.pageSetup = payload.pageSetup as Record<string, unknown>;
    worksheet.mergedRanges = [...payload.mergedRanges];

    for (const [rowIndex, row] of payload.cells) {
      const rowMap = new Map<number, CellState>();
      for (const [cellIndex, state] of row) {
        rowMap.set(cellIndex, { ...state });
      }
      worksheet.cells.set(rowIndex, rowMap);
    }

    return worksheet;
  }

  private static columnLettersToNumber(letters: string): number {
    return letters.toUpperCase().split("").reduce((acc, char) => {
      return acc * 26 + (char.charCodeAt(0) - 64);
    }, 0);
  }
}

class MockWorkbook {
  private worksheets: MockWorksheet[] = [];

  public readonly xlsx = {
    load: async (buffer: Buffer) => {
      const payload = JSON.parse(buffer.toString("utf8")) as {
        worksheets?: ReturnType<MockWorksheet["serialize"]>[];
      };
      this.worksheets = (payload.worksheets ?? []).map((sheet) =>
        MockWorksheet.deserialize(sheet),
      );
    },
    writeBuffer: async () =>
      Buffer.from(
        JSON.stringify({
          worksheets: this.worksheets.map((worksheet) => worksheet.serialize()),
        }),
        "utf8",
      ),
  };

  addWorksheet(name: string): MockWorksheet {
    const worksheet = new MockWorksheet(name);
    this.worksheets.push(worksheet);
    return worksheet;
  }

  getWorksheet(name: string): MockWorksheet | undefined {
    return this.worksheets.find((worksheet) => worksheet.name === name);
  }
}

const ExcelJS = {
  Workbook: MockWorkbook,
};

export default ExcelJS;
export { MockWorkbook as Workbook };
