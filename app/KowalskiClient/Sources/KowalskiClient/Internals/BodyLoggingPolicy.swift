//
//  BodyLoggingPolicy.swift
//  KowalskiClient
//
//  Created by Kamaal M Farah on 11/15/25.
//

import Foundation
import OpenAPIRuntime

enum BodyLoggingPolicy: Equatable {
    case never
    case upTo(maxBytes: Int)

    enum BodyLog: Equatable, CustomStringConvertible {
        /// There is no body to log.
        case none
        /// The policy forbids logging the body.
        case redacted
        /// The body was of unknown length.
        case unknownLength
        /// The body exceeds the maximum size for logging allowed by the policy.
        case tooManyBytesToLog(byteCount: Int64)
        /// The body can be logged.
        case complete(data: Data)

        var description: String {
            switch self {
            case .none:
                return "<none>"
            case .redacted:
                return "<redacted>"
            case .unknownLength:
                return "<unknown length>"
            case let .tooManyBytesToLog(byteCount):
                return "<\(byteCount) bytes>"
            case let .complete(data):
                if let string = String(data: data, encoding: .utf8) { return string }
                return String(describing: data)
            }
        }
    }

    func process(_ body: HTTPBody?) async -> (bodyToLog: BodyLog, bodyForNext: HTTPBody?) {
        guard let body else { return (.none, body) }

        switch self {
        case .never:
            return processNever(body)
        case let .upTo(maxBytes):
            return await processUpTo(body, maxBytes: maxBytes)
        }
    }

    private func processUpTo(_ body: HTTPBody, maxBytes: Int) async -> (bodyToLog: BodyLog, bodyForNext: HTTPBody) {
        let length = body.length
        switch length {
        case .unknown:
            return (.unknownLength, body)
        case let .known(length):
            return await processUpToKnownLength(body, maxBytes: maxBytes, length: length)
        }
    }

    private func processUpToKnownLength(
        _ body: HTTPBody,
        maxBytes: Int,
        length: Int64,
    ) async -> (bodyToLog: BodyLog, bodyForNext: HTTPBody) {
        guard length <= maxBytes else { return (.tooManyBytesToLog(byteCount: length), body) }
        guard let bodyData = try? await Data(collecting: body, upTo: maxBytes) else { return (.none, body) }

        return (.complete(data: bodyData), HTTPBody(bodyData))
    }

    private func processNever(_ body: HTTPBody) -> (bodyToLog: BodyLog, bodyForNext: HTTPBody) {
        (.redacted, body)
    }
}
