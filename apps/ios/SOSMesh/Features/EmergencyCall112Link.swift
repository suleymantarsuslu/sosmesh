import Foundation

enum EmergencyCall112Link {
    static var url: URL {
        let emergencyNumber = EmergencyNumberProvider.getEmergencyNumber()
        return URL(string: "tel:\(emergencyNumber)")!
    }
}
