//
//  KowalskiClientValidationErrorParser.swift
//  KowalskiClient
//
//  Created by OpenAI Codex on 3/29/26.
//

import Foundation

enum KowalskiClientValidationErrorParser {
    static func parseIssues(from payload: some Encodable) -> [KowalskiClientValidationIssue] {
        let data: Data
        do {
            data = try getEncoder().encode(payload)
        } catch {
            return []
        }

        let response = try? getDecoder().decode(ValidationErrorResponse.self, from: data)

        return response?.context?.validations
            .map { issue in
                KowalskiClientValidationIssue(code: issue.code, path: issue.path.map(\.value), message: issue.message)
            } ?? []
    }

    private static func getEncoder() -> JSONEncoder {
        JSONEncoder()
    }

    private static func getDecoder() -> JSONDecoder {
        JSONDecoder()
    }
}

private struct ValidationErrorResponse: Decodable {
    let context: ValidationContext?
}

private struct ValidationContext: Decodable {
    let validations: [ValidationIssue]
}

private struct ValidationIssue: Decodable {
    let code: String
    let path: [ValidationPathComponent]
    let message: String
}

private enum ValidationPathComponent: Decodable {
    case string(String)
    case number(Int)

    var value: String {
        switch self {
        case let .string(value):
            value
        case let .number(value):
            String(value)
        }
    }

    init(from decoder: any Decoder) throws {
        let container = try decoder.singleValueContainer()
        if let stringValue = try? container.decode(String.self) {
            self = .string(stringValue)
            return
        }

        if let numberValue = try? container.decode(Int.self) {
            self = .number(numberValue)
            return
        }

        throw DecodingError.typeMismatch(
            ValidationPathComponent.self,
            .init(
                codingPath: decoder.codingPath,
                debugDescription: "Expected a string or integer validation path component",
            ),
        )
    }
}
