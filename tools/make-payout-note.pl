#!/usr/bin/perl
# Bouwt payout-2026-P-0042.pdf: het document achter "View" in Payout history.
#
# Dit is de uitbetaling zelf, niet de tussenstand: één pagina met briefhoofd,
# aan wie er wordt uitbetaald, waarvoor, en het bedrag dat op de rekening komt.
# De opzet volgt het voorbeeld dat de opdrachtgever aanleverde.
#
# Geen PDF-bibliotheek op de bouwmachine, dus het formaat wordt hier zelf
# samengesteld. Het beeldmerk komt uit hetzelfde SVG-pad als in index.html:
# onderaan staat de omzetter van SVG-pad naar PDF-pad.
use strict;
use warnings;

my $W = 595.28;
my $H = 841.89;
my $M = 62;

my @ops;

sub esc {
  my ($s) = @_;
  $s =~ s/\\/\\\\/g;
  $s =~ s/\(/\\(/g;
  $s =~ s/\)/\\)/g;
  return $s;
}
sub tekst {
  my ($x, $y, $font, $size, $grijs, $s) = @_;
  push @ops, sprintf("BT /%s %.1f Tf %.3f g %.2f %.2f Td (%s) Tj ET",
    $font, $size, $grijs, $x, $H - $y, esc($s));
}
my %w = (' ' => 278, ',' => 278, '.' => 278, '-' => 333, ':' => 278, '/' => 278,
         chr(128) => 556, chr(150) => 556,
         map { $_ => 556 } ('0'..'9'));
sub breedte {
  my ($s, $size) = @_;
  my $t = 0;
  $t += (exists $w{$_} ? $w{$_} : ($_ =~ /[A-Z]/ ? 667 : 556)) for split //, $s;
  return $t * $size / 1000;
}
sub rechts {
  my ($x, $y, $font, $size, $grijs, $s) = @_;
  tekst($x - breedte($s, $size), $y, $font, $size, $grijs, $s);
}
sub band {
  my ($y, $hoogte, $grijs) = @_;
  push @ops, sprintf("%.3f g %.2f %.2f %.2f %.2f re f",
    $grijs, $M, $H - $y - $hoogte, $W - 2 * $M, $hoogte);
}

my $EUR = chr(128);          # WinAnsi: euroteken
my $STREEP = chr(150);       # WinAnsi: en-streepje

sub bedrag {
  my ($c, $min) = @_;
  my $heel = int(abs($c) / 100);
  my $rest = sprintf("%02d", abs($c) % 100);
  1 while $heel =~ s/(\d)(\d{3})(?!\d)/$1.$2/;
  return ($min ? "- " : "") . "$EUR $heel,$rest";
}

# ---- gegevens van deze uitbetaling ----------------------------------------
my $nummer  = '2026-P-0048';
my $datum   = '15-08-2026';
my $periode = "1 augustus 2026 $STREEP 14 augustus 2026";

my $verkoop = 418000;
my $kosten  = 15480;
my $refunds = 4500;
my $uit     = $verkoop - $kosten - $refunds;   # 3.980,20, zoals in de lijst

# ---- briefhoofd ------------------------------------------------------------
logo($M, 74, 26);
tekst($M + 34, 82, 'Helvetica-Bold', 16, 0.05, 'Opining');

my @rechtsboven = (
  'Tel: +31 10 307 1651',
  'info@opiningstore.com',
  'www.opiningstore.com',
  '',
  'KvK: 77851595',
  'BTW: NL003248278813',
  'IBAN: NL39INGB0007188048',
);
my $ry = 68;
for my $r (@rechtsboven) {
  rechts($W - $M, $ry, 'Helvetica', 8.5, 0.45, $r) if $r;
  $ry += 11;
}

# ---- geadresseerde ---------------------------------------------------------
my $y = 168;
tekst($M, $y, 'Helvetica-Bold', 9.5, 0.05, 'Bistro De Kade');
$y += 12;
for my $r ('t.a.v. Sanne Jansen', 'Kadeplein 12', '3011 AB Rotterdam') {
  tekst($M, $y, 'Helvetica', 9.5, 0.3, $r);
  $y += 12;
}

# ---- titel en kenmerken ----------------------------------------------------
$y += 34;
tekst($M, $y, 'Helvetica-Bold', 15, 0.05, 'Uitbetaling');
$y += 22;
for my $r (['Uitbetalingsnummer:', $nummer],
           ['Datum:',              $datum],
           ['Periode:',            $periode]) {
  tekst($M, $y, 'Helvetica', 9, 0.45, $r->[0]);
  tekst($M + 118, $y, 'Helvetica', 9, 0.15, $r->[1]);
  $y += 13;
}

# ---- de opstelling ---------------------------------------------------------
$y += 24;
my @regels = (
  ['Verkoop',            bedrag($verkoop, 0)],
  ['Transactiekosten',   bedrag($kosten, 1)],
  ['Correctie: refunds', bedrag($refunds, 1)],
);
my $om = 0;
for my $r (@regels) {
  band($y - 9, 16, 0.965) if $om % 2 == 0;
  $om++;
  tekst($M + 6, $y, 'Helvetica', 9, 0.25, $r->[0]);
  rechts($W - $M - 6, $y, 'Helvetica', 9, 0.15, $r->[1]);
  $y += 16;
}

$y += 6;
band($y - 10, 18, 0.9);
rechts($W - $M - 148, $y, 'Helvetica-Bold', 9, 0.05, 'Uit te betalen');
rechts($W - $M - 6, $y, 'Helvetica-Bold', 9, 0.05, bedrag($uit, 0));

# ---- afsluiting ------------------------------------------------------------
$y += 40;
my $zin = 'Het bedrag van ' . bedrag($uit, 0)
        . ' wordt binnen enkele dagen op je rekening bijgeschreven.';
tekst($M, $y, 'Helvetica', 8.5, 0.35, $zin);
$y += 12;
tekst($M, $y, 'Helvetica', 8.5, 0.35,
  'Vragen over deze uitbetaling? Mail naar info@opiningstore.com en noem het uitbetalingsnummer.');

# ---- het beeldmerk ---------------------------------------------------------
# Hetzelfde pad als in index.html. SVG rekent y naar beneden en PDF naar boven,
# dus de y-waarden worden gespiegeld; verder is het een-op-een.
sub logo {
  my ($x0, $y0, $maat) = @_;        # x0,y0 = linksboven; maat in punten
  my $s = $maat / 24;
  my $d = svgpad();
  my @deel = $d =~ /([MLHVCZmlhvcz])([^MLHVCZmlhvcz]*)/g;
  my ($cx, $cy, $sx, $sy) = (0, 0, 0, 0);
  push @ops, "0.004 0.451 0.686 rg";   # accentblauw #0172af
  while (@deel) {
    my $cmd = shift @deel;
    my @n = split /[\s,]+/, (shift(@deel) // '');
    @n = grep { length } @n;
    my $abs = $cmd eq uc $cmd;
    $cmd = uc $cmd;
    if ($cmd eq 'M') {
      while (@n >= 2) {
        my ($x, $yv) = (shift @n, shift @n);
        ($cx, $cy) = $abs ? ($x, $yv) : ($cx + $x, $cy + $yv);
        ($sx, $sy) = ($cx, $cy);
        push @ops, sprintf("%.3f %.3f m", $x0 + $cx * $s, $H - $y0 - $cy * $s);
      }
    } elsif ($cmd eq 'L') {
      while (@n >= 2) {
        my ($x, $yv) = (shift @n, shift @n);
        ($cx, $cy) = $abs ? ($x, $yv) : ($cx + $x, $cy + $yv);
        push @ops, sprintf("%.3f %.3f l", $x0 + $cx * $s, $H - $y0 - $cy * $s);
      }
    } elsif ($cmd eq 'H') {
      while (@n) {
        my $x = shift @n;
        $cx = $abs ? $x : $cx + $x;
        push @ops, sprintf("%.3f %.3f l", $x0 + $cx * $s, $H - $y0 - $cy * $s);
      }
    } elsif ($cmd eq 'V') {
      while (@n) {
        my $yv = shift @n;
        $cy = $abs ? $yv : $cy + $yv;
        push @ops, sprintf("%.3f %.3f l", $x0 + $cx * $s, $H - $y0 - $cy * $s);
      }
    } elsif ($cmd eq 'C') {
      while (@n >= 6) {
        my @p = splice(@n, 0, 6);
        unless ($abs) {
          $p[0] += $cx; $p[1] += $cy;
          $p[2] += $cx; $p[3] += $cy;
          $p[4] += $cx; $p[5] += $cy;
        }
        push @ops, sprintf("%.3f %.3f %.3f %.3f %.3f %.3f c",
          $x0 + $p[0] * $s, $H - $y0 - $p[1] * $s,
          $x0 + $p[2] * $s, $H - $y0 - $p[3] * $s,
          $x0 + $p[4] * $s, $H - $y0 - $p[5] * $s);
        ($cx, $cy) = ($p[4], $p[5]);
      }
    } elsif ($cmd eq 'Z') {
      push @ops, "h";
      ($cx, $cy) = ($sx, $sy);
    }
  }
  push @ops, "f";                     # non-zero vulling, zoals in de browser
}

sub svgpad {
  return 'M12 7.03226C9.25659 7.03226 7.03247 9.25641 7.03247 12C7.03247 14.7436 9.25653 16.9677 12 16.9678C13.5112 16.9678 14.8648 16.2927 15.7758 15.228L20.5305 20.4405C20.2906 20.6831 20.0403 20.9154 19.7806 21.1369L15.2885 16.2123L18.6694 21.9783C18.3511 22.1915 18.022 22.3898 17.6831 22.5724L14.6103 17.3317L16.5508 23.1079C16.1386 23.277 15.7149 23.4238 15.2812 23.5467L13.645 18.6762L14.2328 23.7935C13.7556 23.8833 13.2684 23.9449 12.773 23.9764L12.2574 19.4875L11.8511 24C11.3102 23.9934 10.7781 23.9511 10.2568 23.8752L10.6092 19.961L9.42448 23.7238C8.85637 23.5995 8.3033 23.4351 7.76842 23.2334L8.76644 20.0635L7.1106 22.9628C6.54249 22.709 5.9977 22.4124 5.48037 22.077L6.78778 19.7878L5.03312 21.7724C4.49365 21.3871 3.9874 20.9582 3.51955 20.4909L4.93709 18.8875L3.19764 20.1566C2.71928 19.6406 2.28571 19.0824 1.90317 18.4883L2.954 17.7216L1.76406 18.2669C0.645162 16.443 5.59274e-06 14.2971 0 12.0005C5.59274e-06 5.37283 5.3726 0 12 0V7.03226ZM22.0512 18.5585C21.8876 18.8087 21.715 19.0525 21.5337 19.2893L15.8061 15.1922C15.9979 14.9639 16.1694 14.718 16.318 14.4574L22.0512 18.5585ZM23.1567 16.4283C23.0619 16.6667 22.9598 16.9015 22.8505 17.1321L16.4069 14.2946C16.5246 14.0689 16.6256 13.833 16.708 13.5885L23.1567 16.4283ZM23.8234 14.0629C23.7869 14.2739 23.7448 14.483 23.6974 14.69L16.7912 13.3162C16.8471 13.1123 16.8903 12.9031 16.92 12.6896L23.8234 14.0629ZM23.9967 11.7166C23.9989 11.811 24 11.9056 24 12.0005C24 12.0659 23.9995 12.1312 23.9984 12.1963H16.9637C16.9662 12.1312 16.9675 12.0658 16.9675 12C16.9675 11.9049 16.9648 11.8104 16.9595 11.7166H23.9967ZM23.7133 9.38097C23.7433 9.51593 23.771 9.65178 23.7965 9.78836L16.8968 11.1608C16.8735 11.0233 16.8444 10.8876 16.81 10.7541L23.7133 9.38097ZM22.9778 7.14658C23.0339 7.27315 23.0878 7.40078 23.1396 7.52964L16.6398 10.222C16.59 10.0921 16.5349 9.96476 16.4747 9.84032L22.9778 7.14658ZM21.8189 5.10006C21.8987 5.21332 21.9765 5.32809 22.0524 5.44414L16.2038 9.35228C16.1296 9.23482 16.0508 9.12067 15.9673 9.01015L21.8189 5.10006ZM20.2845 3.31874C20.3847 3.41443 20.4833 3.51181 20.5803 3.6109L15.607 8.58436C15.5116 8.48374 15.4121 8.38704 15.3088 8.29465L20.2845 3.31874ZM18.5021 1.91263C18.6186 1.98788 18.7338 2.06509 18.8474 2.14422L14.9386 7.99442C14.827 7.91248 14.712 7.83502 14.5936 7.76242L18.5021 1.91263ZM16.4117 0.836975C16.5407 0.888021 16.6686 0.941222 16.7955 0.996569L14.1026 7.49793C13.9775 7.43943 13.8495 7.38596 13.719 7.3378L16.4117 0.836975ZM14.1508 0.192258C14.2875 0.217001 14.4234 0.244026 14.5586 0.273367L13.1859 7.17471C13.0521 7.14194 12.9161 7.11465 12.7783 7.09295L14.1508 0.192258Z';
}

# ---- objecten --------------------------------------------------------------
my $stroom = join("\n", @ops);
my @obj;
$obj[1] = "<< /Type /Catalog /Pages 2 0 R >>";
$obj[2] = "<< /Type /Pages /Kids [3 0 R] /Count 1 >>";
$obj[3] = sprintf("<< /Type /Page /Parent 2 0 R /MediaBox [0 0 %.2f %.2f] "
  . "/Resources << /Font << /Helvetica 5 0 R /Helvetica-Bold 6 0 R >> >> "
  . "/Contents 4 0 R >>", $W, $H);
$obj[4] = "<< /Length " . length($stroom) . " >>\nstream\n$stroom\nendstream";
$obj[5] = "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>";
$obj[6] = "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold /Encoding /WinAnsiEncoding >>";

my $pdf = "%PDF-1.4\n%\xE2\xE3\xCF\xD3\n";
my @offset;
for my $i (1 .. 6) {
  $offset[$i] = length($pdf);
  $pdf .= "$i 0 obj\n$obj[$i]\nendobj\n";
}
my $start = length($pdf);
$pdf .= "xref\n0 7\n0000000000 65535 f \n";
$pdf .= sprintf("%010d 00000 n \n", $offset[$_]) for 1 .. 6;
$pdf .= "trailer\n<< /Size 7 /Root 1 0 R >>\nstartxref\n$start\n%%EOF\n";

my $uit_bestand = $ARGV[0] or die "geef een bestandsnaam\n";
open my $fh, '>:raw', $uit_bestand or die "kan $uit_bestand niet schrijven: $!";
print $fh $pdf;
close $fh;
printf "ok: %s (%d bytes, uit te betalen %s)\n", $uit_bestand, length($pdf), bedrag($uit, 0);
