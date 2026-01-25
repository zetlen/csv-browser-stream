import { describe, expect, test } from 'bun:test';
import { collect, CollectAbortError, CSVStreamError, streamCSV } from '../src';
import type { CSVRow } from '../src';

describe('collect', () => {
  test('accumulates rows with reducer pattern', async () => {
    const csv = `name,amount
Alice,100
Bob,200
Charlie,300`;

    const stream = streamCSV(csv);
    const total = await collect(stream, (sum, row) => sum + Number(row.amount), 0);

    expect(total).toBe(600);
  });

  test('collects rows into array', async () => {
    const csv = `name,value
a,1
b,2
c,3`;

    const stream = streamCSV(csv);
    const rows = await collect(stream, (arr, row) => [...arr, row], [] as CSVRow[]);

    expect(rows).toHaveLength(3);
    expect(rows[0]).toEqual({ name: 'a', value: '1' });
    expect(rows[1]).toEqual({ name: 'b', value: '2' });
    expect(rows[2]).toEqual({ name: 'c', value: '3' });
  });

  test('works with numeric keys (no headers)', async () => {
    const csv = `a,1
b,2
c,3`;

    const stream = streamCSV(csv, { expectHeaders: false });
    const rows = await collect(stream, (arr, row) => [...arr, row], [] as CSVRow[]);

    expect(rows).toHaveLength(3);
    expect(rows[0]).toEqual({ '1': 'a', '2': '1' });
  });

  test('stops early when callback throws', async () => {
    const csv = `id,name
1,Alice
2,Bob
3,Charlie
4,David
5,Eve`;

    const stream = streamCSV(csv);
    let processedCount = 0;

    try {
      await collect(
        stream,
        (arr, row) => {
          processedCount++;
          arr.push(row);
          if (arr.length >= 2) {
            throw new Error('Stop');
          }
          return arr;
        },
        [] as CSVRow[],
      );
    } catch (err) {
      expect(err).toBeInstanceOf(CollectAbortError);
      expect((err as CollectAbortError).message).toBe('Stop');
      expect((err as CollectAbortError).originalError).toBeInstanceOf(Error);
    }

    // Should have processed at least 2 rows before stopping
    expect(processedCount).toBeGreaterThanOrEqual(2);
  });

  test('handles empty CSV', async () => {
    const csv = `name,value`;

    const stream = streamCSV(csv);
    const result = await collect(stream, (count) => count + 1, 0);

    expect(result).toBe(0);
  });

  test('builds complex accumulator', async () => {
    const csv = `category,amount
food,50
transport,30
food,25
entertainment,100
transport,20`;

    const stream = streamCSV(csv);
    const totals = await collect(
      stream,
      (acc, row) => {
        const category = row.category!;
        const amount = Number(row.amount);
        acc[category] = (acc[category] || 0) + amount;
        return acc;
      },
      {} as Record<string, number>,
    );

    expect(totals).toEqual({
      food: 75,
      transport: 50,
      entertainment: 100,
    });
  });

  test('preserves initial value type', async () => {
    const csv = `x
1
2
3`;

    const stream = streamCSV(csv);
    const result = await collect(
      stream,
      (acc, row) => {
        acc.sum += Number(row.x);
        acc.count++;
        return acc;
      },
      { sum: 0, count: 0 },
    );

    expect(result).toEqual({ sum: 6, count: 3 });
  });

  test('rejects on stream error (header mismatch)', async () => {
    const csv = `wrong,headers
1,2`;

    const stream = streamCSV(csv, { expectHeaders: true, headers: ['name', 'value'] });

    try {
      await collect(stream, (arr, row) => [...arr, row], [] as CSVRow[]);
      expect(true).toBe(false); // Should not reach here
    } catch (err) {
      expect(err).toBeInstanceOf(CSVStreamError);
      expect((err as CSVStreamError).message).toContain('Header mismatch');
      expect((err as CSVStreamError).type).toBe('PARSE_ERROR');
      expect((err as CSVStreamError).lineNum).toBe(1);
    }
  });

  test('rejects on stream error (unbalanced quotes)', async () => {
    const csv = `name,value
"unclosed,quote`;

    const stream = streamCSV(csv);

    try {
      await collect(stream, (arr, row) => [...arr, row], [] as CSVRow[]);
      expect(true).toBe(false); // Should not reach here
    } catch (err) {
      expect(err).toBeInstanceOf(CSVStreamError);
      expect((err as CSVStreamError).type).toBe('UNBALANCED_QUOTES');
    }
  });
});
