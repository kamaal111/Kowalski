//
//  KowalskiValidationErrorParserTests.swift
//  KowalskiClient
//
//  Created by OpenAI Codex on 3/29/26.
//

@testable import KowalskiClient
import Testing

@Suite("Validation Error Parser Tests")
struct KowalskiValidationErrorParserTests {
    @Test
    func `Parser should preserve the full validation path the API returned`() {
        let response = ValidationErrorResponseFixture(
            context: .init(
                validations: [
                    .init(
                        code: "invalid_type",
                        path: [.string("stock"), .string("aliases"), .number(0), .string("symbol")],
                        message: "Expected a ticker symbol",
                    )
                ],
            ),
        )

        let issues = KowalskiClientValidationErrorParser.parseIssues(from: response)

        #expect(
            issues == [
                KowalskiClientValidationIssue(
                    code: "invalid_type",
                    path: ["stock", "aliases", "0", "symbol"],
                    message: "Expected a ticker symbol",
                )
            ],
        )
    }

    @Test
    func `Parser should return an empty list when the error payload has no validation context`() {
        let issues = KowalskiClientValidationErrorParser.parseIssues(from: ValidationErrorResponseFixture(context: nil))

        #expect(issues.isEmpty)
    }
}

private struct ValidationErrorResponseFixture: Encodable {
    let context: ValidationContextFixture?
}

private struct ValidationContextFixture: Encodable {
    let validations: [ValidationIssueFixture]
}

private struct ValidationIssueFixture: Encodable {
    let code: String
    let path: [ValidationPathComponentFixture]
    let message: String
}

private enum ValidationPathComponentFixture: Encodable {
    case string(String)
    case number(Int)

    func encode(to encoder: any Encoder) throws {
        var container = encoder.singleValueContainer()

        switch self {
        case let .string(value):
            try container.encode(value)
        case let .number(value):
            try container.encode(value)
        }
    }
}
