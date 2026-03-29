//
//  KowalskiClientValidationIssue.swift
//  KowalskiClient
//
//  Created by OpenAI Codex on 3/29/26.
//

public struct KowalskiClientValidationIssue: Codable, Equatable, Sendable {
    public let code: String
    public let path: [String]
    public let message: String

    public init(code: String, path: [String], message: String) {
        self.code = code
        self.path = path
        self.message = message
    }

    public var displayPath: String? {
        guard !path.isEmpty else { return nil }

        return path.joined(separator: ".")
    }
}
