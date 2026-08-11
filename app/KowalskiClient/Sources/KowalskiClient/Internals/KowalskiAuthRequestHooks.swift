//
//  KowalskiAuthRequestHooks.swift
//  KowalskiClient
//

import Foundation
import KamaalAuth
import OpenAPIRuntime

/// Translates the generated OpenAPI auth operations into the credential/session contract `KamaalAuth` expects.
///
/// Installed only on ``KowalskiClient/makeTokenClient(url:credentialsKey:credentialsStore:)``, whose
/// `SessionTokenMiddleware` authorizes `issueToken()` with the stored session token rather than the JWT it is
/// about to replace.
struct KowalskiAuthRequestHooks: AuthRequestHooks {
    let client: Client

    func signUp(_ payload: SignUpPayload) async -> AuthRequestOutcome<AuthCredentialHeaders> {
        let response: Operations.PostAppApiAuthSignUpEmail.Output
        do {
            response = try await client.postAppApiAuthSignUpEmail(
                body: .json(.init(email: payload.email, password: payload.password, name: payload.name)),
            )
        } catch {
            return .failure(.unreachable(error))
        }

        switch response {
        case let .created(created):
            return AuthTokenHeadersMapper.credentials(from: created.headers)
        case let .badRequest(payload):
            let body = try? payload.body.json
            return .failure(AuthRequestFailure(status: 400, validations: parseValidationIssues(from: body)))
        case .unauthorized:
            return .failure(AuthRequestFailure(status: 401, code: "MISSING_OR_NULL_ORIGIN"))
        case .conflict:
            return .failure(AuthRequestFailure(status: 409, code: "USER_ALREADY_EXISTS_USE_ANOTHER_EMAIL"))
        case let .undocumented(statusCode, _):
            return .failure(AuthRequestFailure(status: statusCode))
        }
    }

    func signIn(_ payload: SignInPayload) async -> AuthRequestOutcome<AuthCredentialHeaders> {
        let response: Operations.PostAppApiAuthSignInEmail.Output
        do {
            response = try await client.postAppApiAuthSignInEmail(
                body: .json(.init(email: payload.email, password: payload.password)),
            )
        } catch {
            return .failure(.unreachable(error))
        }

        switch response {
        case let .ok(ok):
            return AuthTokenHeadersMapper.credentials(from: ok.headers)
        case let .badRequest(payload):
            let body = try? payload.body.json
            return .failure(AuthRequestFailure(status: 400, validations: parseValidationIssues(from: body)))
        case .unauthorized:
            return .failure(AuthRequestFailure(status: 401, code: "INVALID_EMAIL_OR_PASSWORD"))
        case let .undocumented(statusCode, _):
            return .failure(AuthRequestFailure(status: statusCode))
        }
    }

    func signOut() async -> AuthRequestOutcome<Void> {
        let response: Operations.PostAppApiAuthSignOut.Output
        do {
            response = try await client.postAppApiAuthSignOut()
        } catch {
            return .failure(.unreachable(error))
        }

        switch response {
        case .ok:
            return .success(())
        case .unauthorized:
            return .failure(AuthRequestFailure(status: 401, code: "SESSION_NOT_FOUND"))
        case let .undocumented(statusCode, _):
            return .failure(AuthRequestFailure(status: statusCode))
        }
    }

    func session() async -> AuthRequestOutcome<AuthSession> {
        let response: Operations.GetAppApiAuthSession.Output
        do {
            response = try await client.getAppApiAuthSession()
        } catch {
            return .failure(.unreachable(error))
        }

        switch response {
        case let .ok(ok):
            guard let body = try? ok.body.json else {
                return .failure(AuthRequestFailure(status: 500, code: "INVALID_SESSION_RESPONSE"))
            }

            let session = body.value1

            return .success(
                AuthSession(
                    id: session.user.id,
                    name: session.user.name,
                    email: session.user.email,
                    emailVerified: session.user.emailVerified,
                    createdAt: session.user.createdAt,
                    expiresAt: session.session.expiresAt,
                ),
            )
        case .unauthorized:
            return .failure(AuthRequestFailure(status: 401, code: "SESSION_NOT_FOUND"))
        case let .undocumented(statusCode, _):
            return .failure(AuthRequestFailure(status: statusCode))
        }
    }

    func issueToken() async -> AuthRequestOutcome<AuthCredentialHeaders> {
        let response: Operations.GetAppApiAuthToken.Output
        do {
            response = try await client.getAppApiAuthToken()
        } catch {
            return .failure(.unreachable(error))
        }

        switch response {
        case let .ok(ok):
            return AuthTokenHeadersMapper.credentials(from: ok.headers)
        case .unauthorized:
            return .failure(AuthRequestFailure(status: 401, code: "SESSION_NOT_FOUND"))
        case let .undocumented(statusCode, _):
            return .failure(AuthRequestFailure(status: statusCode))
        }
    }

    private func parseValidationIssues(from payload: (some Encodable)?) -> [AuthValidationIssue] {
        guard let payload else { return [] }

        return KowalskiClientValidationErrorParser.parseIssues(from: payload).map { issue in
            AuthValidationIssue(code: issue.code, path: issue.path, message: issue.message)
        }
    }
}
