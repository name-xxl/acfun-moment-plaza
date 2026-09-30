import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parser } from '../src/parser.js';
import { state } from '../src/state.js';

test('@提及 转用户链接', () => {
    assert.equal(
        parser.parseContent('[at uid=123]@小明[/at]'),
        '<a class="plaza-at-link" href="//www.acfun.cn/u/123" target="_blank">@小明</a>'
    );
});

test('@提及 的用户名做 HTML 转义（防属性逃逸）', () => {
    const html = parser.parseContent('[at uid=1]@" onmouseover="alert(1)[/at]');
    assert.ok(!html.includes('" onmouseover'), html);
    assert.ok(html.includes('&quot; onmouseover'), html);
});

test('#话题# 转搜索链接（关键词 encodeURIComponent）', () => {
    assert.equal(
        parser.parseContent('#话题#'),
        '<a class="plaza-topic-link" href="//www.acfun.cn/search?keyword=%E8%AF%9D%E9%A2%98" target="_blank">#话题#</a>'
    );
});

test('裸 ac 号转文章链接', () => {
    assert.equal(
        parser.parseContent('看这个 ac12345678'),
        '看这个 <a class="plaza-ac-link" href="//www.acfun.cn/a/ac12345678" target="_blank">ac12345678</a>'
    );
});

test('v/ 与 a/ 前缀分别转视频/文章链接', () => {
    assert.ok(parser.parseContent('v/ac12345678').includes('href="//www.acfun.cn/v/ac12345678"'));
    assert.ok(parser.parseContent('a/ac12345678').includes('href="//www.acfun.cn/a/ac12345678"'));
    assert.ok(parser.parseContent('v/ac12345678').includes('>v/ac12345678<'));
});

test('m.acfun.cn 动态短链转 am 链接', () => {
    assert.equal(
        parser.parseContent('m.acfun.cn/communityCircle/moment/123'),
        '<a class="plaza-ac-link" href="//www.acfun.cn/moment/am123" target="_blank">am123</a>'
    );
});

test('[ac=]@video 紧凑方言转视频链接（feedSquare 形态）', () => {
    assert.equal(
        parser.parseContent('[ac=48879687@video]标题[/ac]'),
        '<a class="plaza-ac-link plaza-ac-video" href="//www.acfun.cn/v/ac48879687" target="_blank">标题</a>'
    );
});

test('[ac=] 无后缀/@article 走文章链接', () => {
    const html = parser.parseContent('[ac=48879687]文字[/ac]');
    assert.ok(html.includes('href="//www.acfun.cn/a/ac48879687"'));
    assert.ok(!html.includes('plaza-ac-video'));
});

test('[resource] 详情方言：type=2 视频带标题', () => {
    assert.equal(
        parser.parseContent('[resource id=48879687 type=2 icon=play]视频标题[/resource]'),
        '<a class="plaza-ac-link plaza-ac-video" href="//www.acfun.cn/v/ac48879687" target="_blank">视频标题</a>'
    );
});

test('[resource] type=3 文章不带视频图标类', () => {
    const html = parser.parseContent('[resource id=9 type=3 icon=x]文章标题[/resource]');
    assert.ok(html.includes('href="//www.acfun.cn/a/ac9"'));
    assert.ok(!html.includes('plaza-ac-video'));
});

test('规则顺序：[ac=] 包住的裸 ac 号先被渲染、再被剥掉合成单链接（不嵌套）', () => {
    const html = parser.parseContent('[ac=1234@video]ac5678[/ac]');
    assert.equal(html.match(/<a\b/g)?.length, 1, html);
    assert.ok(html.includes('>ac5678</a>'), html);
});

test('主包表情：有映射渲染 img，无映射降级灰字占位', () => {
    state.emoticonMap = { 1673: { url: 'https://img.example/a.png', big: '', name: '笑', pkg: 'acfun' } };
    assert.equal(
        parser.parseContent('[emot=acfun,1673/]'),
        '<img class="ubb-emotion" data-pkgname="acfun" src="https://img.example/a.png">'
    );
    state.emoticonMap = null;
    assert.equal(parser.parseContent('[emot=acfun,1673/]'), '<span style="color:#999;font-size:12px;">[表情]</span>');
});

test('非 acfun 主包老表情走 umeditor 静态路径', () => {
    assert.equal(
        parser.parseContent('[emot=biaoqing,5/]'),
        '<img class="ubb-emotion" src="//cdn.aixifan.com/dotnet/20130418/umeditor/dialogs/emotion/images/biaoqing/5.gif">'
    );
});

test('[img] UBB 图片转 img 标签', () => {
    assert.equal(
        parser.parseContent('[img=图片]https://a.example/x.png[/img]'),
        '<img class="plaza-ubb-img" src="https://a.example/x.png">'
    );
});

test('API 明文 [表情] 渲染灰字占位', () => {
    assert.equal(parser.parseContent('[表情]'), '<span style="color:#999;font-size:12px;">[表情]</span>');
});

test('HTML 先转义再解析，脚本标签不成活', () => {
    const html = parser.parseContent('<script>alert(1)</script>');
    assert.ok(!html.includes('<script>'), html);
    assert.ok(html.includes('&lt;script&gt;'), html);
});

test('正文换行转 <br>', () => {
    assert.equal(parser.parseContent('a\nb'), 'a<br>b');
});

test('plainText 剥出纯文本（转发卡片标题用）', () => {
    assert.equal(parser.plainText('[at uid=1]@小明[/at] 看 ac12345678'), '@小明 看 ac12345678');
    assert.equal(parser.plainText('[resource id=9 type=2 icon=ic]标题[/resource]'), '标题');
    assert.equal(parser.plainText('[emot=acfun,1673/]哈哈'), '哈哈');
    assert.equal(parser.plainText('[img=图片]https://a.example/x.png[/img]'), '[图]');
    assert.equal(parser.plainText('a\n\n  b'), 'a b');
});

test('UBB 生成端与解析端同源（插表情/带图评论闭环）', () => {
    assert.equal(parser.emotUbb('acfun', 1673), '[emot=acfun,1673/]');
    assert.equal(parser.imgUbb('https://a.example/x.png'), '[img=图片]https://a.example/x.png[/img]');
    assert.ok(parser.parseContent(parser.imgUbb('https://a.example/x.png')).includes('src="https://a.example/x.png"'));
});
