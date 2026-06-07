import CryptoKit

extension SHA256.Digest {
    var hexString: String {
        let characters = Array("0123456789abcdef")

        return reduce(into: "") { result, byte in
            result.append(characters[Int(byte >> 4)])
            result.append(characters[Int(byte & 0x0F)])
        }
    }
}
