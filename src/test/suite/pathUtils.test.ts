import { expect } from 'chai';
import { splitOutsideQuotes } from '../../utilities/pathUtils';

describe('pathUtils', () => {
    describe('splitOutsideQuotes', () => {
        it('should split a basic string by semicolons', () => {
            const input = 'a;b;c';
            const result = splitOutsideQuotes(input);
            expect(result).to.deep.equal(['a', 'b', 'c']);
        });

        it('should not split within quoted sections', () => {
            const input = 'a;"b;c";d';
            const result = splitOutsideQuotes(input);
            expect(result).to.deep.equal(['a', '"b;c"', 'd']);
        });

        it('should handle empty segments', () => {
            const input = 'a;;b;c';
            const result = splitOutsideQuotes(input);
            expect(result).to.deep.equal(['a', '', 'b', 'c']);
        });

        it('should handle delimiter at the end', () => {
            const input = 'a;b;c;';
            const result = splitOutsideQuotes(input);
            expect(result).to.deep.equal(['a', 'b', 'c', '']);
        });

        it('should handle escaped quotes', () => {
            const input = 'a;"b\\"c;d";e';
            const result = splitOutsideQuotes(input);
            expect(result).to.deep.equal(['a', '"b\\"c;d"', 'e']);
        });

        it('should handle empty string', () => {
            const input = '';
            const result = splitOutsideQuotes(input);
            expect(result).to.deep.equal([]);
        });

        it('should handle string without delimiters', () => {
            const input = 'abc';
            const result = splitOutsideQuotes(input);
            expect(result).to.deep.equal(['abc']);
        });

        it('should handle complex cases with multiple quotes', () => {
            const input = 'a;"b;c";"d;e";f';
            const result = splitOutsideQuotes(input);
            expect(result).to.deep.equal(['a', '"b;c"', '"d;e"', 'f']);
        });

        it('should handle unclosed quotes', () => {
            const input = 'a;"b;c';
            const result = splitOutsideQuotes(input);
            // When quotes are not closed, everything after the opening quote is treated
            // as being inside quotes, so the semicolon is not treated as a delimiter
            expect(result).to.deep.equal(['a', '"b;c']);
        });

        it('should handle quotes in the middle of a segment', () => {
            const input = 'a;b"c;d"e;f';
            const result = splitOutsideQuotes(input);
            // The quotes toggle the quote state, so "c;d" is inside quotes
            expect(result).to.deep.equal(['a', 'b"c;d"e', 'f']);
        });
    });
});
