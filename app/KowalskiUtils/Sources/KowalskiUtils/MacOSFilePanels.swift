//
//  MacOSFilePanels.swift
//  KowalskiUtils
//
//  Created by Copilot on 4/12/26.
//

import Foundation
import UniformTypeIdentifiers

#if os(macOS)
    import AppKit

    @MainActor
    public enum MacOSFilePanels {
        public static func chooseFileURL(contentTypes: [UTType]) -> URL? {
            let panel = NSOpenPanel()
            panel.allowedContentTypes = contentTypes
            panel.allowsMultipleSelection = false
            panel.canChooseDirectories = false
            panel.canChooseFiles = true
            panel.canCreateDirectories = false

            guard panel.runModal() == .OK else { return nil }

            return panel.urls.first
        }

        public static func saveData(
            _ contents: Data,
            suggestedFilename: String,
            contentTypes: [UTType],
        ) throws -> Bool {
            let panel = NSSavePanel()
            panel.allowedContentTypes = contentTypes
            panel.canCreateDirectories = true
            panel.isExtensionHidden = false
            panel.nameFieldStringValue = suggestedFilename

            guard panel.runModal() == .OK else { return false }
            guard let destinationURL = panel.url else { return false }

            try SecurityScopedFileAccess.withAccess(to: destinationURL) { destinationURL in
                try contents.write(to: destinationURL, options: .atomic)
            }

            return true
        }

        public static func saveTemporaryFile(
            at temporaryURL: URL,
            suggestedFilename: String? = nil,
            contentTypes: [UTType],
        ) throws -> Bool {
            defer { removeTemporaryFileIfPresent(at: temporaryURL) }

            let contents = try Data(contentsOf: temporaryURL)

            return try saveData(
                contents,
                suggestedFilename: suggestedFilename ?? temporaryURL.lastPathComponent,
                contentTypes: contentTypes,
            )
        }

        private static func removeTemporaryFileIfPresent(at url: URL) {
            guard FileManager.default.fileExists(atPath: url.path) else { return }

            _ = try? FileManager.default.removeItem(at: url)
        }
    }
#endif
