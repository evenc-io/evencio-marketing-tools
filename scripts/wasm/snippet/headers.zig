const std = @import("std");
const common = @import("common.zig");

const allocator = common.allocator;

fn trimLineEnding(line: []const u8) []const u8 {
    if (line.len == 0) return line;
    if (line[line.len - 1] == '\r') return line[0 .. line.len - 1];
    return line;
}

fn skipWhitespace(line: []const u8, idx: *usize) void {
    while (idx.* < line.len and common.isWhitespace(line[idx.*])) : (idx.* += 1) {}
}

fn matchLineComment(line: []const u8) ?usize {
    var idx: usize = 0;
    skipWhitespace(line, &idx);
    if (idx + 1 >= line.len or line[idx] != '/' or line[idx + 1] != '/') return null;
    idx += 2;
    skipWhitespace(line, &idx);
    return idx;
}

fn matchLineDirective(line: []const u8, directive: []const u8) ?usize {
    const idx = matchLineComment(line) orelse return null;
    if (idx + directive.len > line.len) return null;
    if (!std.mem.eql(u8, line[idx .. idx + directive.len], directive)) return null;
    return idx + directive.len;
}

fn isSnippetFileStartLine(line: []const u8) bool {
    const idx = matchLineDirective(line, "@snippet-file") orelse return false;
    if (idx >= line.len) return true;
    return common.isWhitespace(line[idx]);
}

fn isSnippetFileEndLine(line: []const u8) bool {
    const idx = matchLineDirective(line, "@snippet-file-end") orelse return false;
    var cursor = idx;
    while (cursor < line.len and common.isWhitespace(line[cursor])) : (cursor += 1) {}
    return cursor >= line.len;
}

fn isAutoImportComment(line: []const u8) bool {
    const idx = matchLineComment(line) orelse return false;
    const marker = "Auto-managed imports";
    if (idx + marker.len > line.len) return false;
    var i: usize = 0;
    while (i < marker.len) : (i += 1) {
        const a = line[idx + i];
        const b = marker[i];
        const lower_a = if (a >= 'A' and a <= 'Z') a + 32 else a;
        const lower_b = if (b >= 'A' and b <= 'Z') b + 32 else b;
        if (lower_a != lower_b) return false;
    }
    return true;
}

fn isImportLine(line: []const u8) bool {
    const idx = matchLineDirective(line, "@import") orelse return false;
    return idx < line.len and common.isWhitespace(line[idx]);
}

fn isBlankLine(line: []const u8) bool {
    for (line) |c| {
        if (!common.isWhitespace(c)) return false;
    }
    return true;
}

fn appendLine(out: *std.ArrayList(u8), line: []const u8, wrote_line: *bool) !void {
    if (wrote_line.*) {
        try out.append(allocator, '\n');
    }
    try out.appendSlice(allocator, line);
    wrote_line.* = true;
}

fn matchExportName(line: []const u8) ?[]const u8 {
    var idx: usize = 0;
    skipWhitespace(line, &idx);
    if (idx + 6 > line.len) return null;
    if (!std.mem.eql(u8, line[idx .. idx + 6], "export")) return null;
    idx += 6;
    if (idx >= line.len or !common.isWhitespace(line[idx])) return null;
    skipWhitespace(line, &idx);

    const keyword = if (idx + 5 <= line.len and std.mem.eql(u8, line[idx .. idx + 5], "const"))
        "const"
    else if (idx + 8 <= line.len and std.mem.eql(u8, line[idx .. idx + 8], "function"))
        "function"
    else if (idx + 5 <= line.len and std.mem.eql(u8, line[idx .. idx + 5], "class"))
        "class"
    else
        return null;

    idx += keyword.len;
    if (idx >= line.len or !common.isWhitespace(line[idx])) return null;
    skipWhitespace(line, &idx);
    if (idx >= line.len or !common.isIdentifierStart(line[idx])) return null;
    const start = idx;
    idx += 1;
    while (idx < line.len and common.isIdentifierChar(line[idx])) : (idx += 1) {}
    return line[start..idx];
}

pub fn stripSnippetDirectives(source: []const u8) ![]u8 {
    var out = std.ArrayList(u8).empty;
    var wrote_line = false;
    var it = std.mem.splitScalar(u8, source, '\n');
    while (it.next()) |line_raw| {
        const line = trimLineEnding(line_raw);
        if (isSnippetFileStartLine(line) or isSnippetFileEndLine(line)) {
            continue;
        }
        try appendLine(&out, line, &wrote_line);
    }
    if (out.items.len == 0) {
        return @constCast(&[_]u8{});
    }
    return out.toOwnedSlice(allocator);
}

pub fn stripAutoImportBlock(source: []const u8) ![]u8 {
    var out = std.ArrayList(u8).empty;
    var wrote_line = false;
    var it = std.mem.splitScalar(u8, source, '\n');
    var saw_import = false;
    var skipping = true;
    while (it.next()) |line_raw| {
        const line = trimLineEnding(line_raw);
        if (isSnippetFileStartLine(line) or isSnippetFileEndLine(line)) {
            continue;
        }
        if (skipping) {
            if (isAutoImportComment(line) or isImportLine(line)) {
                saw_import = true;
                continue;
            }
            if (saw_import and isBlankLine(line)) {
                continue;
            }
            skipping = false;
        }
        try appendLine(&out, line, &wrote_line);
    }
    if (out.items.len == 0) {
        return @constCast(&[_]u8{});
    }
    return out.toOwnedSlice(allocator);
}

pub fn scanAutoImportOffset(source: []const u8) u32 {
    var it = std.mem.splitScalar(u8, source, '\n');
    var saw_import = false;
    var offset: u32 = 0;
    while (it.next()) |line_raw| {
        const line = trimLineEnding(line_raw);
        if (isSnippetFileStartLine(line) or isSnippetFileEndLine(line)) {
            continue;
        }
        if (isAutoImportComment(line) or isImportLine(line)) {
            saw_import = true;
            offset += 1;
            continue;
        }
        if (saw_import and isBlankLine(line)) {
            offset += 1;
            continue;
        }
        break;
    }
    return offset;
}

pub fn scanPrimaryExportName(source: []const u8) ![]u8 {
    var it = std.mem.splitScalar(u8, source, '\n');
    while (it.next()) |line_raw| {
        const line = trimLineEnding(line_raw);
        if (matchExportName(line)) |name| {
            return allocator.dupe(u8, name);
        }
    }
    return @constCast(&[_]u8{});
}

pub fn scanExportNames(source: []const u8) ![]u8 {
    var seen = std.StringHashMap(void).init(allocator);
    defer seen.deinit();

    var out = std.ArrayList(u8).empty;
    var it = std.mem.splitScalar(u8, source, '\n');
    while (it.next()) |line_raw| {
        const line = trimLineEnding(line_raw);
        if (matchExportName(line)) |name| {
            if (!seen.contains(name)) {
                try seen.put(name, {});
                if (out.items.len > 0) {
                    try out.append(allocator, '\n');
                }
                try out.appendSlice(allocator, name);
            }
        }
    }
    if (out.items.len == 0) {
        return @constCast(&[_]u8{});
    }
    return out.toOwnedSlice(allocator);
}
