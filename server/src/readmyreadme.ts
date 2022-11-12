import { Diagnostic, DiagnosticSeverity, Range } from "vscode-languageserver";
import { TextDocument } from "vscode-languageserver-textdocument";

export function validateOutlineStructure(textDocument: TextDocument): Diagnostic {

    const diagnostic: Diagnostic = {
        severity: DiagnosticSeverity.Error,
        range: Range.create(0, 0, 0, 0),
        message: "This is a test diagnostic",
        source: "outline"
    };
    
     return Diagnostic.create(Range.create(0,0,0, 10), 'Your Structure could be optimized', DiagnosticSeverity.Warning)
}