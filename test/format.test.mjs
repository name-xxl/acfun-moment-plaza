import { test } from 'node:test';
import assert from 'node:assert/strict';
import { format } from '../src/format.js';

test('formatTime 相对时间分档', () => {
    const now = Date.now();
    assert.equal(format.formatTime(now), '刚刚');
    assert.equal(format.formatTime(now - 5 * 60000), '5分钟前');
    assert.equal(format.formatTime(now - 2 * 3600000), '2小时前');
    assert.equal(format.formatTime(now - 3 * 86400000), '3天前');
});

test('formatTime 超过 30 天落绝对日期', () => {
    // 用本地时区构造，保证 getFullYear/getMonth/getDate 取回一致
    const ts = new Date(2020, 0, 5, 8, 0, 0).getTime();
    assert.equal(format.formatTime(ts), '2020-01-05');
});

test('formatTime 空值返回空串', () => {
    assert.equal(format.formatTime(0), '');
    assert.equal(format.formatTime(null), '');
});

test('parseAgeMs 相对时间四单位', () => {
    assert.equal(format.parseAgeMs('30秒前'), 30 * 1000);
    assert.equal(format.parseAgeMs('40分钟前'), 40 * 60000);
    assert.equal(format.parseAgeMs('3小时前'), 3 * 3600000);
    assert.equal(format.parseAgeMs('2天前'), 2 * 86400000);
});

test('parseAgeMs 绝对时间返回距今时长（API 偶发标准时间）', () => {
    const age = format.parseAgeMs('2020-01-01T00:00:00Z');
    assert.ok(age > 5 * 365 * 86400000, `age=${age}`);
});

test('parseAgeMs 无法解析返回 0', () => {
    assert.equal(format.parseAgeMs(''), 0);
    assert.equal(format.parseAgeMs('不知道'), 0);
    assert.equal(format.parseAgeMs(null), 0);
});

test('computeAbsTs 由相对时间反推绝对时间戳', () => {
    const fetched = Date.now();
    const abs = format.computeAbsTs('40分钟前', fetched);
    assert.ok(Math.abs(abs - (fetched - 40 * 60000)) < 1000, `abs=${abs}`);
});

test('computeAbsTs 兜底：解析不了就退回抓取时刻', () => {
    assert.equal(format.computeAbsTs('不知道', 5000), 5000);
    assert.equal(format.computeAbsTs('', 5000), 5000);
    assert.ok(Math.abs(format.computeAbsTs('不知道') - Date.now()) < 1000);
});

test('formatNumber 万位缩写', () => {
    assert.equal(format.formatNumber(0), '0');
    assert.equal(format.formatNumber(9999), '9999');
    assert.equal(format.formatNumber(10000), '1.0万');
    assert.equal(format.formatNumber(23456), '2.3万');
    assert.equal(format.formatNumber(null), '0');
});
