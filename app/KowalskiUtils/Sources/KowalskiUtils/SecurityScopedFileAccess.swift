//
//  SecurityScopedFileAccess.swift
//  KowalskiUtils
//
//  Created by Copilot on 4/12/26.
//

import Foundation

public protocol SecurityScopedFileURL {
    var fileURL: URL { get }

    func startAccessingSecurityScopedResource() -> Bool
    func stopAccessingSecurityScopedResource()
}

extension URL: SecurityScopedFileURL {
    public var fileURL: URL {
        self
    }
}

public enum SecurityScopedFileAccess {
    public static func withAccess<T>(
        to file: some SecurityScopedFileURL,
        _ block: (URL) throws -> T,
    ) rethrows -> T {
        let startedAccessingSecurityScopedResource = file.startAccessingSecurityScopedResource()
        defer {
            if startedAccessingSecurityScopedResource {
                file.stopAccessingSecurityScopedResource()
            }
        }
        return try block(file.fileURL)
    }

    public static func readString(
        from file: some SecurityScopedFileURL,
        encoding: String.Encoding = .utf8,
    ) throws -> String {
        try withAccess(to: file) { fileURL in
            try String(contentsOf: fileURL, encoding: encoding)
        }
    }
}
