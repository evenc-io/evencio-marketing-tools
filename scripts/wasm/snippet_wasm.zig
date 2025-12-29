const std = @import("std");
const common = @import("snippet/common.zig");
const tailwind = @import("snippet/tailwind.zig");
const security = @import("snippet/security.zig");
const inspect = @import("snippet/inspect.zig");
const hash = @import("snippet/hash.zig");
const files = @import("snippet/files.zig");
const headers = @import("snippet/headers.zig");

const allocator = common.allocator;

/// Allocates a buffer in the WASM heap for the JS bridge to write into.
export fn alloc(len: usize) usize {
    if (len == 0) return 0;
    const buf = allocator.alloc(u8, len) catch return 0;
    return @intFromPtr(buf.ptr);
}

/// Frees a buffer returned by alloc() or scan_* exports.
export fn free(ptr: usize, len: usize) void {
    if (ptr == 0 or len == 0) return;
    const slice = @as([*]u8, @ptrFromInt(ptr))[0..len];
    allocator.free(slice);
}

/// Scans Tailwind class candidates and returns a newline-delimited string.
export fn scan_tailwind_candidates(ptr: usize, len: usize, out_len_ptr: usize) usize {
    if (ptr == 0 or len == 0 or out_len_ptr == 0) return 0;

    const source = @as([*]const u8, @ptrFromInt(ptr))[0..len];
    const out = tailwind.scanTailwindCandidates(source) catch return 0;
    const out_len = @min(out.len, @as(usize, std.math.maxInt(u32)));

    const out_len_ptr_u32 = @as(*u32, @ptrFromInt(out_len_ptr));
    out_len_ptr_u32.* = @intCast(out_len);

    if (out_len == 0) {
        return 0;
    }

    return @intFromPtr(out.ptr);
}

/// Scans for disallowed imports, globals, and calls.
export fn scan_security_issues(ptr: usize, len: usize, out_len_ptr: usize) usize {
    if (ptr == 0 or len == 0 or out_len_ptr == 0) return 0;

    const source = @as([*]const u8, @ptrFromInt(ptr))[0..len];
    const out = security.scanSecurityIssues(source) catch return 0;
    const out_len = @min(out.len, @as(usize, std.math.maxInt(u32)));

    const out_len_ptr_u32 = @as(*u32, @ptrFromInt(out_len_ptr));
    out_len_ptr_u32.* = @intCast(out_len);

    if (out_len == 0) {
        return 0;
    }

    return @intFromPtr(out.ptr);
}

/// Builds the JSX inspect index for preview highlighting.
export fn scan_inspect_index(ptr: usize, len: usize, out_len_ptr: usize) usize {
    if (ptr == 0 or len == 0 or out_len_ptr == 0) return 0;

    const source = @as([*]const u8, @ptrFromInt(ptr))[0..len];
    const out = inspect.scanInspectIndex(source) catch return 0;
    const out_len = @min(out.len, @as(usize, std.math.maxInt(u32)));

    const out_len_ptr_u32 = @as(*u32, @ptrFromInt(out_len_ptr));
    out_len_ptr_u32.* = @intCast(out_len);

    if (out_len == 0) {
        return 0;
    }

    return @intFromPtr(out.ptr);
}

/// Returns the 32-bit FNV-1a hash of the source bytes.
export fn hash_bytes(ptr: usize, len: usize) u32 {
    if (ptr == 0 or len == 0) return 0;
    const source = @as([*]const u8, @ptrFromInt(ptr))[0..len];
    return hash.hashBytes(source);
}

/// Scans snippet file blocks and expands imports, returning a binary payload.
export fn scan_snippet_files(ptr: usize, len: usize, out_len_ptr: usize) usize {
    if (ptr == 0 or len == 0 or out_len_ptr == 0) return 0;

    const source = @as([*]const u8, @ptrFromInt(ptr))[0..len];
    const out = files.scanSnippetFiles(source) catch return 0;
    const out_len = @min(out.len, @as(usize, std.math.maxInt(u32)));

    const out_len_ptr_u32 = @as(*u32, @ptrFromInt(out_len_ptr));
    out_len_ptr_u32.* = @intCast(out_len);

    if (out_len == 0) {
        return 0;
    }

    return @intFromPtr(out.ptr);
}

/// Removes snippet file directives and returns the cleaned source.
export fn strip_snippet_directives(ptr: usize, len: usize, out_len_ptr: usize) usize {
    if (ptr == 0 or len == 0 or out_len_ptr == 0) return 0;

    const source = @as([*]const u8, @ptrFromInt(ptr))[0..len];
    const out = headers.stripSnippetDirectives(source) catch return 0;
    const out_len = @min(out.len, @as(usize, std.math.maxInt(u32)));

    const out_len_ptr_u32 = @as(*u32, @ptrFromInt(out_len_ptr));
    out_len_ptr_u32.* = @intCast(out_len);

    if (out_len == 0) {
        return 0;
    }

    return @intFromPtr(out.ptr);
}

/// Removes snippet directives plus the auto-managed import block.
export fn strip_auto_import_block(ptr: usize, len: usize, out_len_ptr: usize) usize {
    if (ptr == 0 or len == 0 or out_len_ptr == 0) return 0;

    const source = @as([*]const u8, @ptrFromInt(ptr))[0..len];
    const out = headers.stripAutoImportBlock(source) catch return 0;
    const out_len = @min(out.len, @as(usize, std.math.maxInt(u32)));

    const out_len_ptr_u32 = @as(*u32, @ptrFromInt(out_len_ptr));
    out_len_ptr_u32.* = @intCast(out_len);

    if (out_len == 0) {
        return 0;
    }

    return @intFromPtr(out.ptr);
}

/// Returns the number of lines in the auto-managed import block.
export fn scan_auto_import_offset(ptr: usize, len: usize) u32 {
    if (ptr == 0 or len == 0) return 0;

    const source = @as([*]const u8, @ptrFromInt(ptr))[0..len];
    return headers.scanAutoImportOffset(source);
}

/// Scans for the first named export in the source.
export fn scan_primary_export(ptr: usize, len: usize, out_len_ptr: usize) usize {
    if (ptr == 0 or len == 0 or out_len_ptr == 0) return 0;

    const source = @as([*]const u8, @ptrFromInt(ptr))[0..len];
    const out = headers.scanPrimaryExportName(source) catch return 0;
    const out_len = @min(out.len, @as(usize, std.math.maxInt(u32)));

    const out_len_ptr_u32 = @as(*u32, @ptrFromInt(out_len_ptr));
    out_len_ptr_u32.* = @intCast(out_len);

    if (out_len == 0) {
        return 0;
    }

    return @intFromPtr(out.ptr);
}

/// Scans for named exports and returns a newline-delimited list.
export fn scan_export_names(ptr: usize, len: usize, out_len_ptr: usize) usize {
    if (ptr == 0 or len == 0 or out_len_ptr == 0) return 0;

    const source = @as([*]const u8, @ptrFromInt(ptr))[0..len];
    const out = headers.scanExportNames(source) catch return 0;
    const out_len = @min(out.len, @as(usize, std.math.maxInt(u32)));

    const out_len_ptr_u32 = @as(*u32, @ptrFromInt(out_len_ptr));
    out_len_ptr_u32.* = @intCast(out_len);

    if (out_len == 0) {
        return 0;
    }

    return @intFromPtr(out.ptr);
}
