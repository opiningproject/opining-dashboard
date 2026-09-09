#!/usr/bin/perl
# Bouwt payouts-export.pdf: het bestand achter de exportknop op Finance.
#
# Alle uitbetalingen van de gekozen periode onder elkaar, met een totaal.
# In productie maakt de server dit per gekozen periode; dit bestand toont de
# vorm. Geen PDF-bibliotheek op de bouwmachine, dus het formaat wordt hier zelf
# samengesteld — dezelfde aanpak als de andere twee documenten.
use strict;
use warnings;

my $W = 595.28;
my $H = 841.89;
my $M = 52;
my $ONDER = $H - 64;

my @paginas;
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
my %w = (' ' => 278, ',' => 278, '.' => 278, '-' => 333, chr(128) => 556,
         chr(150) => 556, map { $_ => 556 } ('0'..'9'));
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
sub lijn {
  my ($y, $grijs) = @_;
  push @ops, sprintf("%.3f G 0.6 w %.2f %.2f m %.2f %.2f l S",
    $grijs, $M, $H - $y, $W - $M, $H - $y);
}
sub band {
  my ($y, $hoogte, $grijs) = @_;
  push @ops, sprintf("%.3f g %.2f %.2f %.2f %.2f re f",
    $grijs, $M, $H - $y - $hoogte, $W - 2 * $M, $hoogte);
}

my $EUR = chr(128);
sub euro {
  my ($c) = @_;
  my $heel = int($c / 100);
  my $rest = sprintf("%02d", $c % 100);
  1 while $heel =~ s/(\d)(\d{3})(?!\d)/$1.$2/;
  return "$EUR $heel,$rest";
}

# ---- de uitbetalingen ------------------------------------------------------
# Wekelijks, zoals in Payout history. Vaste reeks: het bestand is elke bouw
# hetzelfde.
my @weken = (
  ['2026-P-0048', '22 Aug 2026', 124000, 'In transit'],
  ['2026-P-0047', '15 Aug 2026', 398020, 'Paid'],
  ['2026-P-0046', '8 Aug 2026',  412675, 'Paid'],
  ['2026-P-0045', '1 Aug 2026',  374410, 'Paid'],
  ['2026-P-0044', '25 Jul 2026', 298045, 'Paid'],
  ['2026-P-0043', '18 Jul 2026', 431000, 'Paid'],
  ['2026-P-0042', '11 Jul 2026', 226620, 'Paid'],
  ['2026-P-0041', '4 Jul 2026',  389415, 'Paid'],
);
my $totaal = 0;
$totaal += $_->[2] for @weken;

my $y;

sub paginakop {
  tekst($M, 42, 'Helvetica-Bold', 9.5, 0.15, 'Opining');
  rechts($W - $M, 42, 'Helvetica', 9, 0.45, 'Payouts export');
  lijn(50, 0.8);
}
sub tabelkop {
  band($y - 11, 17, 0.94);
  tekst($M + 4, $y, 'Helvetica-Bold', 8.5, 0.35, 'PAYOUT');
  tekst($M + 110, $y, 'Helvetica-Bold', 8.5, 0.35, 'DATE');
  tekst($M + 220, $y, 'Helvetica-Bold', 8.5, 0.35, 'STATUS');
  rechts($W - $M - 4, $y, 'Helvetica-Bold', 8.5, 0.35, 'AMOUNT');
  $y += 17;
}

paginakop();
$y = 92;
tekst($M, $y, 'Helvetica-Bold', 17, 0.05, 'Payouts');
$y += 18;
tekst($M, $y, 'Helvetica', 9.5, 0.45,
  '1 July 2026 ' . chr(150) . ' 9 September 2026 - ' . scalar(@weken) . ' payouts');
$y += 34;

tabelkop();
my $om = 0;
for my $p (@weken) {
  band($y - 11, 16, 0.975) if $om % 2;
  $om++;
  tekst($M + 4, $y, 'Helvetica', 9, 0.15, $p->[0]);
  tekst($M + 110, $y, 'Helvetica', 9, 0.3, $p->[1]);
  tekst($M + 220, $y, 'Helvetica', 9, 0.45, $p->[3]);
  rechts($W - $M - 4, $y, 'Helvetica', 9, 0.15, euro($p->[2]));
  $y += 16;
}

$y += 8;
band($y - 11, 18, 0.9);
tekst($M + 4, $y, 'Helvetica-Bold', 9.5, 0.05, 'Total paid out in this period');
rechts($W - $M - 4, $y, 'Helvetica-Bold', 9.5, 0.05, euro($totaal));

$y += 40;
tekst($M, $y, 'Helvetica', 8.5, 0.4,
  'Each payout has its own statement with the orders it covers, available under View in Payout history.');

push @paginas, [@ops];

# ---- voet ------------------------------------------------------------------
for my $i (0 .. $#paginas) {
  @ops = ();
  lijn($H - 40, 0.85);
  tekst($M, $H - 26, 'Helvetica', 8, 0.5,
    'Opining - exported on 9 September 2026 - amounts in EUR');
  rechts($W - $M, $H - 26, 'Helvetica', 8, 0.5,
    'Page ' . ($i + 1) . ' of ' . scalar(@paginas));
  push @{ $paginas[$i] }, @ops;
}

# ---- objecten --------------------------------------------------------------
my @obj;
my @paginaobj;
my $nr = 5;
for my $p (@paginas) {
  my $pagina = $nr++;
  my $stroom = $nr++;
  push @paginaobj, $pagina;
  $obj[$pagina] = sprintf("<< /Type /Page /Parent 2 0 R /MediaBox [0 0 %.2f %.2f] "
    . "/Resources << /Font << /Helvetica 3 0 R /Helvetica-Bold 4 0 R >> >> "
    . "/Contents %d 0 R >>", $W, $H, $stroom);
  my $inhoud = join("\n", @$p);
  $obj[$stroom] = "<< /Length " . length($inhoud) . " >>\nstream\n$inhoud\nendstream";
}
$obj[1] = "<< /Type /Catalog /Pages 2 0 R >>";
$obj[2] = "<< /Type /Pages /Kids [" . join(" ", map { "$_ 0 R" } @paginaobj)
        . "] /Count " . scalar(@paginaobj) . " >>";
$obj[3] = "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>";
$obj[4] = "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold /Encoding /WinAnsiEncoding >>";

my $laatste = $nr - 1;
my $pdf = "%PDF-1.4\n%\xE2\xE3\xCF\xD3\n";
my @offset;
for my $i (1 .. $laatste) {
  $offset[$i] = length($pdf);
  $pdf .= "$i 0 obj\n$obj[$i]\nendobj\n";
}
my $start = length($pdf);
$pdf .= "xref\n0 " . ($laatste + 1) . "\n0000000000 65535 f \n";
$pdf .= sprintf("%010d 00000 n \n", $offset[$_]) for 1 .. $laatste;
$pdf .= "trailer\n<< /Size " . ($laatste + 1) . " /Root 1 0 R >>\nstartxref\n$start\n%%EOF\n";

my $uit = $ARGV[0] or die "geef een bestandsnaam\n";
open my $fh, '>:raw', $uit or die "kan $uit niet schrijven: $!";
print $fh $pdf;
close $fh;
printf "ok: %s (%d bytes, %d uitbetalingen, totaal %s)\n",
  $uit, length($pdf), scalar(@weken), euro($totaal);
